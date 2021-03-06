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

### Step 5: Create the main Hyperledger Fabric orderer network

1. SSH or Go back to bastion EC2 instance, created from step 1.

```bash
ssh -i ~/${KEYPAIR_NAME} ec2-user@${BASTION_PUBLIC_DNS}
```

2. Clone this repository to bastion instance.

```bash
cd
git clone https://github.com/thesixnetwork/aws-eks-fabric.git
```

3. Edit env.sh

```bash
cd
cd aws-eks-fabric/scripts
vi env.sh
```

Change `org0` `org1` `org2` to your preferred name.

4. Config EFS endpoint.

```bash
vi ~/aws-eks-fabric/fabric-main/gen-fabric.sh
vi ~/aws-eks-fabric/workshop-remote-peer/gen-workshop-remote-peer.sh
```

You can find the full EFS server URL in the AWS EFS console. The URL should look something like this: EFSSERVER=fs-12a33ebb.efs.us-west-2.amazonaws.com

5. Generate the Kubernetes YAML files

```bash
cd
cd aws-eks-fabric
mkdir /opt/share/rca-scripts
cp scripts/* /opt/share/rca-scripts
cd
cd aws-eks-fabric/fabric-main
./gen-fabric.sh
```
6. Start Fabric Network

```bash
cd
cd aws-eks-fabric/fabric-main
./start-fabric.sh
```

7. Check if network is successfully start

```bash
kubectl get pods --all-namespaces

```

### Step 6: Start an Elasticsearch

1. Start an ElasticSearch cluster manually

- Select all Public subnets created from previous steps.
- Select same security group as EKS node groups `(eks-cluster-sg)`
- Select an access policies to `JSON defined access policy`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "es:*",
      "Resource": "arn:aws:es:ap-southeast-1:082007557883:domain/fabric-es/*"
    }
  ]
}
```

2. Config security group as EKS node groups to allow connection from Bastion instance `(ec2-cmd-client-InstanceSecurityGroup)`

- Add allow connection from bastion security group `(ec2-cmd-client-InstanceSecurityGroup)` to EKS node group securiyy group `(eks-cluster-sg)`
 
3. Try testing telnet from Bastion instance to ElasticSearch cluster to verify that ElasticSearch can now be access from Bastion host.

```bash
$ telnet vpc-fabric-es-gqja2jmx6ojsjx3aokuimgjzq4.ap-southeast-1.es.amazonaws.com 80
Trying 192.168.59.103...
Connected to vpc-fabric-es-gqja2jmx6ojsjx3aokuimgjzq4.ap-southeast-1.es.amazonaws.com.
Escape character is '^]'.
Connection closed by foreign host.
```

### Step 7: Install Logstash on Bastion

1. SSH to Bastion instance and install Nginx. (In case we want to use it as a proxy for ElasticSearch)

```bash
yum install nginx
```

2. SSH to Bastion instance and install Logstash for syncing log from Hyperledger Fabric to ElasticSearch

Execute command below to retrieve Elastic's public key

```bash
rpm -import https://artifacts.elastic.co/GPG-KEY-elasticsearch
```

Install Java8

```bash
sudo yum install java-1.8.0-openjdk
```

Make java8 default

```bash
alternatives --config java
```

Then, create `logstash.repo` to `/etc/yum.repos.d/`

```bash
echo "[logstash-6.x]
name=Elastic repository for 6.x packages
baseurl=https://artifacts.elastic.co/packages/6.x/yum
gpgcheck=1
gpgkey=https://artifacts.elastic.co/GPG-KEY-elasticsearch
enabled=1
autorefresh=1
type=rpm-md" >> /etc/yum.repos.d/logstash.repo
```

Install

```bash
sudo yum install logstash
```

Install logstash plugin for CouchDB

```bash
sudo /usr/share/logstash/bin/logstash-plugin install logstash-input-couchdb_changes
sudo /usr/share/logstash/bin/logstash-plugin install logstash-output-sqs
```

### Step 8: Create SQS

Create an sqs name `hyperledger-logstash`

### Step 9: Config and start logstash

1. Create IAM user for pushing SQS message from logstash

- Go to IAM page
- Create user
- username = `hyperledger-logstash-sqs-pusher`
- accesss_type = `Programmatic access`
- Attach `AmazonSQSFullAccess` policy
- Save `Access key ID` and `Secret access key`

2. SSH to Bastion instance and go to logstash config directory

Create a conf file at `/etc/logstash/conf.d/org1.conf`

```
input {
  couchdb_changes {
    host => "a0cb0649b682c11ea9e1a0affb936c25-02db3289a4dbf536.elb.ap-southeast-1.amazonaws.com"
    port => 5984
    db => "mychannel_echo_asset"
    keep_id => true
    sequence_path => "/tmp/.couchdb_org1_seq_echo"
  }
}

output {
  sqs {
    queue => "hyperledger-logstash"
    region => "ap-southeast-1"
    access_key_id => "XXXXXX"
    secret_access_key => "XXXXXX"
  }
}
```

Create a conf file at `/etc/logstash/conf.d/org2.conf`

```
input {
  couchdb_changes {
    host => "a0dbbc44f682c11ea867a068e8cf007c-32b2b87d31bb53a8.elb.ap-southeast-1.amazonaws.com"
    port => 5984
    db => "mychannel_echo_asset"
    keep_id => true
    sequence_path => "/tmp/.couchdb_org2_seq_echo"
  }
}

output {
  sqs {
    queue => "hyperledger-logstash"
    region => "ap-southeast-1"
    access_key_id => "XXXXXX"
    secret_access_key => "XXXXXX"
  }
}
```

Then, start logstash

```bash
initctl restart logstash
```

# Troubleshooting

##### Could not generate genesis block
The script gen-channel-artifacts was unable to generate the genesis block. The error was cryptic. I debugged this by
removing lines from configtx.yaml until I found the offender was org2. It turned out that the admin cert for org2 
had not been generated, i.e. it did not exist in directory: /data/orgs/org1/admin/msp/admincerts. This led me back
to the register-org.sh script, which showed an error when trying to generate the admin cert. I re-ran the script and
it worked fine. Can't explain why it failed the first time and succeeded the second time.

```bash
2019-03-14 06:56:23.254 UTC [common.tools.configtxgen] main -> WARN 001 Omitting the channel ID for configtxgen for output operations is deprecated.  Explicitly passing the channel ID will be required in the future, defaulting to 'testchainid'.
2019-03-14 06:56:23.254 UTC [common.tools.configtxgen] main -> INFO 002 Loading configuration
2019-03-14 06:56:23.264 UTC [common.tools.configtxgen.localconfig] completeInitialization -> INFO 003 orderer type: kafka
2019-03-14 06:56:23.264 UTC [common.tools.configtxgen.localconfig] Load -> INFO 004 Loaded configuration: /etc/hyperledger/fabric/configtx.yaml
2019-03-14 06:56:23.275 UTC [common.tools.configtxgen.localconfig] completeInitialization -> INFO 005 orderer type: kafka
2019-03-14 06:56:23.275 UTC [common.tools.configtxgen.localconfig] LoadTopLevel -> INFO 006 Loaded configuration: /etc/hyperledger/fabric/configtx.yaml
2019-03-14 06:56:23.373 UTC [common.tools.configtxgen] func1 -> PANI 007 proto: Marshal called with nil
panic: proto: Marshal called with nil [recovered]
        panic: proto: Marshal called with nil

goroutine 1 [running]:
github.com/hyperledger/fabric/vendor/go.uber.org/zap/zapcore.(*CheckedEntry).Write(0xc0000f5a20, 0x0, 0x0, 0x0)
        /opt/gopath/src/github.com/hyperledger/fabric/vendor/go.uber.org/zap/zapcore/entry.go:229 +0x515
github.com/hyperledger/fabric/vendor/go.uber.org/zap.(*SugaredLogger).log(0xc00000e248, 0xc00021f704, 0xc0003008a0, 0x1e, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0)
        /opt/gopath/src/github.com/hyperledger/fabric/vendor/go.uber.org/zap/sugar.go:234 +0xf6
github.com/hyperledger/fabric/vendor/go.uber.org/zap.(*SugaredLogger).Panicf(0xc00000e248, 0xc0003008a0, 0x1e, 0x0, 0x0, 0x0)
        /opt/gopath/src/github.com/hyperledger/fabric/vendor/go.uber.org/zap/sugar.go:159 +0x79
github.com/hyperledger/fabric/common/flogging.(*FabricLogger).Panic(0xc00000e250, 0xc00021f818, 0x1, 0x1)
        /opt/gopath/src/github.com/hyperledger/fabric/common/flogging/zap.go:73 +0x75
main.main.func1()
        /opt/gopath/src/github.com/hyperledger/fabric/common/tools/configtxgen/main.go:250 +0x1a9
panic(0xd8c500, 0xc0000670f0)
        /opt/go/src/runtime/panic.go:513 +0x1b9
```

To recreate the certs for an org, you'll need to delete the existing cert directory before running the register pod:

```bash
sudo rm -rf /opt/share/rca-data/orgs/org0
```
I delete the register deployment and run ./start-fabric.sh again.

```bash
kubectl delete -f aws-eks-fabric/k8s/fabric-deployment-register-org-org0.yaml 
kubectl delete -f aws-eks-fabric/k8s/fabric-deployment-register-orderer-org0.yaml 
```

Then rerun fabric-start.sh:

```bash
cd ~
cd aws-eks-fabric/fabric-main
./start-fabric.sh
```
##### Orderer pods not starting

A 'kubectl logs' on the orderer shows this:

```bash
##### 2019-03-20 09:43:24 copyAdminCert - copying '/data/orgs/org0/msp/admincerts/cert.pem' to '/etc/hyperledger/orderer/msp/admincerts'
cp: cannot stat '/data/orgs/org0/msp/admincerts/cert.pem': No such file or directory
```
I follow the same steps as the issue above (it's the same issue). except I also delete and restart the orderers:

```bash
kubectl delete -f aws-eks-fabric/k8s/fabric-deployment-orderer1-org0.yaml 
kubectl delete -f aws-eks-fabric/k8s/fabric-deployment-orderer2-org0.yaml 
kubectl delete -f aws-eks-fabric/k8s/fabric-deployment-orderer3-org0.yaml 
```

# More contents

*deploy or update chaincode* : https://github.com/thesixnetwork/aws-eks-fabric/wiki/Deploy-chaincode

