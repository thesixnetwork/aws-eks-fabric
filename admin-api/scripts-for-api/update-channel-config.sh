#!/bin/bash

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

function main {

    # Set ORDERER_PORT_ARGS to the args needed to communicate with the 3rd orderer
    IFS=', ' read -r -a OORGS <<< "$ORDERER_ORGS"
    initOrdererVars ${OORGS[0]} 3
    export ORDERER_PORT_ARGS="-o $ORDERER_HOST:$ORDERER_PORT --cafile $CA_CHAINFILE"

    if [ "$SYSTEM_CHANNEL" = true ]; then
        log "Updating the channel config block for the system channel '$CHANNEL_NAME' for the new org '$NEW_ORG'"
        # Set MSP to orderer
        export CORE_PEER_MSPCONFIGPATH=/data/orgs/org0/admin/msp
        export CORE_PEER_LOCALMSPID=org0MSP
    else
        log "Updating the channel config block for the application channel '$CHANNEL_NAME' for the new org '$NEW_ORG'"
        # Use the first peer of the first org for admin activities
        IFS=', ' read -r -a PORGS <<< "$PEER_ORGS"
        initPeerVars ${PORGS[0]} 1
    fi

    # Update the channel config
    updateChannelConfig
}

# Apply the new channel configuration to the channel
function updateChannelConfig {
    log "Updating the configuration block of the channel '$CHANNEL_NAME' using config file /${DATA}/${CHANNEL_NAME}_${NEW_ORG}_config_update_as_envelope.pb"
    log "peer channel update -f /${DATA}/${CHANNEL_NAME}_${NEW_ORG}_config_update_as_envelope.pb -c $CHANNEL_NAME $ORDERER_PORT_ARGS"
    peer channel update -f /${DATA}/${CHANNEL_NAME}_${NEW_ORG}_config_update_as_envelope.pb -c $CHANNEL_NAME $ORDERER_PORT_ARGS
    log "Updated the configuration block of the channel '$CHANNEL_NAME' using config file /${DATA}/${CHANNEL_NAME}_${NEW_ORG}_config_update_as_envelope.pb"
    return 0
}

DATADIR=/data
SCRIPTS=/scripts
REPO=aws-eks-fabric
source $SCRIPTS/env.sh
echo "Args are: " $*
CHANNEL_NAME=$1
NEW_ORG=$2
SYSTEM_CHANNEL=$3
main
