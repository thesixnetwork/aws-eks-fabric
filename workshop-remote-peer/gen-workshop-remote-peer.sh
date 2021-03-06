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

EFSSERVER=fs-99a736d1.efs.us-east-1.amazonaws.com
REPO=aws-eks-fabric
DATA=/opt/share
SCRIPTS=$DATA/rca-scripts
source $SCRIPTS/env.sh
source $HOME/$REPO/fabric-main/utilities.sh
source $HOME/$REPO/fabric-main/gen-fabric-functions.sh
K8SYAML=k8s
DATA=/opt/share

function main {
    log "Beginning creation of Hyperledger Fabric Kubernetes YAML files for workshop..."
    cd $HOME/$REPO
    rm -rf $K8SYAML
    mkdir -p $K8SYAML
    genFabricOrgs
    genNamespaces
    genPVC
    genRCA
    genICA
    genRegisterOrg
    genRegisterPeers
    genWorkshopRemotePeers
    genFabricTestMarblesWorkshop
    log "Creation of Hyperledger Fabric Kubernetes YAML files for workshop complete"
}

main

