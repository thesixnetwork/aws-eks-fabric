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
privateNodegroup=true # set to true if you want eksctl to create the EKS worker nodes in private subnets


echo Download the kubectl and heptio-authenticator-aws binaries and save to ~/bin
mkdir ~/bin
wget https://amazon-eks.s3-us-west-2.amazonaws.com/1.10.3/2018-06-05/bin/linux/amd64/kubectl && chmod +x kubectl && mv kubectl ~/bin/
wget https://amazon-eks.s3-us-west-2.amazonaws.com/1.10.3/2018-06-05/bin/linux/amd64/heptio-authenticator-aws && chmod +x heptio-authenticator-aws && mv heptio-authenticator-aws ~/bin/

echo Download eksctl from eksctl.io
curl --silent --location "https://github.com/weaveworks/eksctl/releases/download/latest_release/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

echo Create a keypair
cd ~
aws ec2 create-key-pair --key-name eks-fabric --region $region --query 'KeyMaterial' --output text > eks-fabric.pem
chmod 400 eks-fabric.pem
sleep 10

cd ~
eksctl create cluster --node-private-networking --ssh-access --ssh-public-key eks-fabric --name eks-fabric --region $region --node-type m5.xlarge --node-volume-size 200 --kubeconfig=./kubeconfig.eks-fabric.yaml

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

# hmmm, this part needs a fix. SUBNETS is not a bash array, so NUMSUBNETS will not represent the correct number of subnets
SUBNETS=$(eksctl get cluster --name=eks-fabric --region $region --verbose=0 --output=json | jq  '.[0].ResourcesVpcConfig.SubnetIds')
NUMSUBNETS=${#SUBNETS[@]}
echo -e "Checking that 6 subnets have been created. eksctl created ${NUMSUBNETS} subnets"

if [ $NUMSUBNETS neq 6 ]; then
    echo -e "6 subnets have not been created for this EKS cluster. There should be 3 public and 3 private. This script will fail if it continues. Stopping now. Investigate why eksctl did not create the required number of subnets"
    exit 1
fi

SUBNETA=$(echo $SUBNETS | jq '.[0]' | tr -d '"')
SUBNETB=$(echo $SUBNETS | jq '.[1]' | tr -d '"')
SUBNETC=$(echo $SUBNETS | jq '.[2]' | tr -d '"')
echo -e "SUBNETS: $SUBNETS"
echo -e "SUBNETS: $SUBNETA, $SUBNETB, $SUBNETC"

cd ~/aws-eks-fabric
git checkout efs/deploy-ec2.sh

echo Update the ~/aws-eks-fabric/efs/deploy-ec2.sh config file
sed -e "s/{VPCID}/${VPCID}/g" -e "s/{REGION}/${region}/g" -e "s/{SUBNETA}/${SUBNETA}/g" -e "s/{SUBNETB}/${SUBNETB}/g" -e "s/{SUBNETC}/${SUBNETC}/g" -i ~/aws-eks-fabric/efs/deploy-ec2.sh

echo ~/aws-eks-fabric/efs/deploy-ec2.sh script has been updated with your parameters
cat ~/aws-eks-fabric/efs/deploy-ec2.sh

echo Running ~/aws-eks-fabric/efs/deploy-ec2.sh - this will use CloudFormation to create the EC2 bastion and EFS
cd ~/aws-eks-fabric/
./efs/deploy-ec2.sh

PublicDnsNameBastion=$(aws ec2 describe-instances --region $region --filters "Name=tag:Name,Values=EFS FileSystem Mounted Instance" "Name=instance-state-name,Values=running" | jq '.Reservations | .[] | .Instances | .[] | .PublicDnsName' | tr -d '"')
echo public DNS of EC2 bastion host: $PublicDnsNameBastion

if [ "$privateNodegroup" == "true" ]; then
    PrivateDnsNameEKSWorker=$(aws ec2 describe-instances --region $region --filters "Name=tag:Name,Values=eks-fabric-*-Node" "Name=instance-state-name,Values=running" | jq '.Reservations | .[] | .Instances | .[] | .PrivateDnsName' | tr -d '"')
    echo private DNS of EKS worker nodes, accessible from Bastion only since they are in a private subnet: $PrivateDnsNameEKSWorker
    cd ~
    # we need the keypair on the bastion, since we can only access the K8s worker nodes from the bastion
    scp -i eks-fabric.pem -q ~/eks-fabric.pem  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/eks-fabric.pem
else
    PublicDnsNameEKSWorker=$(aws ec2 describe-instances --region $region --filters "Name=tag:Name,Values=eks-fabric-*-Node" "Name=instance-state-name,Values=running" | jq '.Reservations | .[] | .Instances | .[] | .PublicDnsName' | tr -d '"')
    echo public DNS of EKS worker nodes: $PublicDnsNameEKSWorker
fi

echo Prepare the EC2 bastion for use by copying the kubeconfig and aws config and credentials files from Cloud9
cd ~
scp -i eks-fabric.pem -q ~/kubeconfig.eks-fabric.yaml  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/kubeconfig.eks-fabric.yaml
scp -i eks-fabric.pem -q ~/.aws/config  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/config
scp -i eks-fabric.pem -q ~/.aws/credentials  ec2-user@${PublicDnsNameBastion}:/home/ec2-user/credentials
