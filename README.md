# Creating an EKS cluster and deploy Hyperledger Fabric on AWS

This repository helps you create and deploy a production ready for Hyperledger Fabric on AWS platform using EKS cluster.

## Steps

### Step 1: Create a Kubernetes cluster

The easiest way to create a Kubernetes cluster is using a eksctl tool from EC2 or Cloud9:

1. Launch an EC2 (Ubuntu) or Open Cloud9 IDE, then SSH to the instance.
2. Install kubectl:

```bash
cd
sudo su
curl -LO https://storage.googleapis.com/kubernetes-release/release/`curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt`/bin/linux/amd64/kubectl
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl
kubectl version --client
```

3. Install aws-cli

```bash
sudo apt update && sudo apt upgrade
sudo apt install python3-pip
pip3 install --upgrade pip
sudo -H pip3 install awscli --upgrade --user
aws --version
```

4. In the instance terminal, execute `sudo apt install awscli -y` to install aws-cli
5. Then execute `aws configure` to configure credentials. The credentials
you enter here are the AWS access key and secret key that belong to the AWS account you will use to create your EKS cluster.
6. Go to home dir, then clone this repo:

```bash
sudo su
cd
git clone https://github.com/thesixnetwork/aws-eks-fabric.git
cd aws-eks-fabric
```

7. Run the bash script:

```bash
cd
cd aws-eks-fabric
./eks/create-eks.sh
```

Done creating EKS cluster with bastion EC2 instance.

### Step 2: Install EFS utils on each Kubernetes worker node

1. SSH to bastion EC2 instance, created from step 1.

```bash
ssh -i ~/${KEYPAIR_NAME} ec2-user@${BASTION_PUBLIC_DNS}
```

2. Then, ssh to Kubernetes worker nodes and execute command below in each nodes

```bash
ssh -i ~/${KEYPAIR_NAME} ec2-user@${EKS_NODES_PUBLIC_DNS}
sudo yum install -y amazon-efs-utils
```

### Step 3: Copy kubeconfig and AWS config & credentials files

Now SSH into the EC2 bastion instance created in Step 1:

```bash
ssh -i ~/${KEYPAIR_NAME} ec2-user@${BASTION_PUBLIC_DNS}
```

Update aws cli

```bash
curl -O https://bootstrap.pypa.io/get-pip.py
python get-pip.py --user
export PATH=~/.local/bin:$PATH
source ~/.bash_profile
pip install awscli --upgrade --user
```

Copy the aws config & credentials files:

```bash
mkdir -p /home/ec2-user/.aws
cd /home/ec2-user/.aws
mv /home/ec2-user/config .
mv /home/ec2-user/credentials .
```

Check that the AWS CLI works:

```bash
aws s3 ls
```

You may or may not see S3 buckets, but you shouldn't receive an error.

Copy the kube config file:

```bash
mkdir -p /home/ec2-user/.kube
cd /home/ec2-user/.kube
mv /home/ec2-user/kubeconfig.eks-fabric.yaml  ./config
```

To check that this works execute:

```bash
kubectl get nodes
```

You should see the nodes belonging to your new K8s cluster. You may see more nodes, depending on the size of the Kubernetes
cluster you created. If you are using EKS you will NOT see any master nodes:

```bash
$ kubectl get nodes
NAME                                           STATUS   ROLES    AGE   VERSION
ip-192-168-62-115.us-west-2.compute.internal   Ready    <none>   2d    v1.10.3
ip-192-168-77-242.us-west-2.compute.internal   Ready    <none>   2d    v1.10.3
```

### Step 4: Create the main Hyperledger Fabric orderer network

1. SSH or Go back to bastion EC2 instance, created from step 1.

```bash
ssh -i ~/${KEYPAIR_NAME} ec2-user@${BASTION_PUBLIC_DNS}
```

2. Clone this repository to bastion instance.

```bash
cd
git clone https://github.com/thesixnetwork/aws-eks-fabric.git
```
