#!/usr/bin/env bash

# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this
# software and associated documentation files (the "Software"), to deal in the Software
# without restriction, including without limitation the rights to use, copy, modify,
# merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
# INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
# PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

region=ap-southeast-1
keypairName=eks-fabric-dev
privateNodegroup=true # set to true if you want eksctl to create the EKS worker nodes in private subnets


echo Download the kubectl and heptio-authenticator-aws binaries and save to ~/bin
mkdir ~/bin
wget https://amazon-eks.s3-us-west-2.amazonaws.com/1.10.3/2018-06-05/bin/linux/amd64/kubectl && chmod +x kubectl && mv kubectl ~/bin/
wget https://amazon-eks.s3-us-west-2.amazonaws.com/1.10.3/2018-06-05/bin/linux/amd64/heptio-authenticator-aws && chmod +x heptio-authenticator-aws && mv heptio-authenticator-aws ~/bin/

echo Download eksctl from eksctl.io
curl --silent --location "https://github.com/weaveworks/eksctl/releases/download/latest_release/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

echo Create a keypair

aws ec2 describe-key-pairs --key-names $keypairName | grep $keypairName
if [[ $? -eq 1 ]]; then
  echo "Keypair does not exists, try creating one"
  cd ~
  aws ec2 create-key-pair --key-name $keypairName --region $region --query 'KeyMaterial' --output text > ${keypairName}.pem
  chmod 400 ~/${keypairName}.pem
  sleep 10
fi


cd ~
eksctl create cluster --node-private-networking --ssh-access --ssh-public-key $keypairName --name eks-fabric --region $region --node-type m5.xlarge --node-volume-size 200 --kubeconfig=./kubeconfig.eks-fabric.yaml

echo Check whether kubectl can access your Kubernetes cluster
kubectl --kubeconfig=./kubeconfig.eks-fabric.yaml get nodes

echo Create the EC2 bastion instance and the EFS that stores the Fabric cryptographic material
echo These will be created in the same VPC as the EKS cluster

echo installing jq
if [ "$(uname)" == "Darwin" ]; then
  sudo brew -y install jq
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  sudo apt -y install jq
fi

echo Getting VPC and Subnets from eksctl
VPCID=$(eksctl get cluster --name=eks-fabric --region $region --verbose=0 --output=json | jq  '.[0].ResourcesVpcConfig.VpcId' | tr -d '"')
echo -e "VPCID: $VPCID"

PUBLIC_SUBNETS=$(aws ec2 describe-subnets | jq ".Subnets[] | select(.VpcId == \"${VPCID}\") | select(.Tags[] | select(.Value | test(\"Public\"))) | .SubnetId" | uniq | tr "\n" " ")
PUBLIC_SUBNET1=$(echo $PUBLIC_SUBNETS| cut -d" " -f1)
PUBLIC_SUBNET2=$(echo $PUBLIC_SUBNETS| cut -d" " -f2)
PUBLIC_SUBNET3=$(echo $PUBLIC_SUBNETS| cut -d" " -f3)
echo -e "PUBLIC_SUBNETS: $PUBLIC_SUBNETS"
echo -e "PUBLIC_SUBNETS: $PUBLIC_SUBNET1, $PUBLIC_SUBNET2, $PUBLIC_SUBNET3"

cd ~/aws-eks-fabric
git checkout efs/deploy-ec2.sh

echo Update the ~/aws-eks-fabric/efs/deploy-ec2.sh config file
sed -e "s/{VPCID}/${VPCID}/g" -e "s/{REGION}/${region}/g" -e "s/{SUBNETA}/${PUBLIC_SUBNET1}/g" -e "s/{SUBNETB}/${PUBLIC_SUBNET2}/g" -e "s/{SUBNETC}/${PUBLIC_SUBNET3}/g" -e "s/{KEYPAIRNAME}/${keypairName}/g" -i ~/aws-eks-fabric/efs/deploy-ec2.sh

echo ~/aws-eks-fabric/efs/deploy-ec2.sh script has been updated with your parameters
cat ~/aws-eks-fabric/efs/deploy-ec2.sh

echo Running ~/aws-eks-fabric/efs/deploy-ec2.sh - this will use CloudFormation to create the EC2 bastion and EFS
cd ~/aws-eks-fabric/
./efs/deploy-ec2.sh

PublicDnsNameBastion=$(aws ec2 describe-instances --region $region --filters "Name=tag:Name,Values=eks-fabric-bastion" "Name=instance-state-name,Values=running" | jq '.Reservations | .[] | .Instances | .[] | .PublicDnsName' | tr -d '"')
echo public DNS of EC2 bastion host: $PublicDnsNameBastion

PrivateDnsNameEKSWorker=$(aws ec2 describe-instances --region $region --filters "Name=tag:Name,Values=eks-fabric-*-Node" "Name=instance-state-name,Values=running" | jq '.Reservations | .[] | .Instances | .[] | .PrivateDnsName' | tr -d '"')
echo private DNS of EKS worker nodes, accessible from Bastion only since they are in a private subnet: $PrivateDnsNameEKSWorker
if [ ! -f ~/${keypairName}.pem ]; then
  cd ~
  scp -i ${keypairName}.pem -q ~/${keypairName}.pem  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/${keypairName}.pem

  echo Prepare the EC2 bastion for use by copying the kubeconfig and aws config and credentials files from Cloud9
  cd ~
  scp -i ${keypairName}.pem -q ~/kubeconfig.eks-fabric.yaml  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/kubeconfig.eks-fabric.yaml
  scp -i ${keypairName}.pem -q ~/.aws/config  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/config
  scp -i ${keypairName}.pem -q ~/.aws/credentials  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/credentials
fi
echo Success creating EKS cluster
