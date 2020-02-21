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

#vpc details for cluster: fabric-account-1
region=ap-southeast-1
vpcid=vpc-083ff287c96aae3a5
subneta=subnet-0ee357543eb0e11a4
subnetb=subnet-05d01047c307933e8
subnetc=subnet-0266dd1dbd940cc89
keypairname=eks-fabric
volumename=dltefs
mountpoint=opt/share

aws cloudformation deploy --stack-name ec2-cmd-client --template-file efs/ec2-for-efs-3AZ.yaml \
--capabilities CAPABILITY_NAMED_IAM \
--parameter-overrides VPCId=$vpcid SubnetA=$subneta SubnetB=$subnetb SubnetC=$subnetc \
KeyName=$keypairname VolumeName=$volumename MountPoint=$mountpoint \
--region $region
