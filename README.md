# Creating an EKS cluster and deploy Hyperledger Fabric on AWS

This repository helps you create and deploy a production ready for Hyperledger Fabric on AWS platform using EKS cluster.

## Steps

### Step 1: Create a Kubernetes cluster

The easiest way to create a Kubernetes cluster is using a eksctl tool from EC2 or Cloud9:

1. Launch an EC2 (Ubuntu) or Open Cloud9 IDE, then SSH to the instance.
2. In the instance terminal, execute `aws configure` to configure credentials. The credentials
you enter here are the AWS access key and secret key that belong to the AWS account you will use to create your EKS cluster.
3. Go to home dir, then clone this repo:

```bash
sudo su
cd
git clone git@github.com:thesixnetwork/aws-eks-fabric.git
cd aws-eks-fabric
```

4. Run the bash script:

```bash
cd
cd aws-eks-fabric
./eks/create-eks.sh
```

Deploy EKS and Hyperledger Fabric
