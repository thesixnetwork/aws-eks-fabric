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

3. In the instance terminal, execute `sudo apt install awscli -y` to install aws-cli
4. Then execute `aws configure` to configure credentials. The credentials
you enter here are the AWS access key and secret key that belong to the AWS account you will use to create your EKS cluster.
5. Go to home dir, then clone this repo:

```bash
sudo su
cd
git clone https://github.com/thesixnetwork/aws-eks-fabric.git
cd aws-eks-fabric
```

6. Run the bash script:

```bash
cd
cd aws-eks-fabric
./eks/create-eks.sh
```

Deploy EKS and Hyperledger Fabric
