/*
# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# or in the "license" file accompanying this file. This file is distributed 
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
# express or implied. See the License for the specific language governing 
# permissions and limitations under the License.
#
*/

'use strict';
//var log4js = require('log4js');
//log4js.configure({
//	appenders: {
//	  out: { type: 'stdout' },
//	},
//	categories: {
//	  default: { appenders: ['out'], level: 'debug' },
//	}
//});
//var logger = log4js.getLogger('FABRICAPI');
const WebSocketServer = require('ws');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var cors = require('cors');
var hfc = require('fabric-client');
const logger = hfc.getLogger('app.js');

const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, X509WalletMixin } = require('fabric-network');
const uuidv4 = require('uuid/v4');

var connection = require('./connection.js');
var gateway = require('./gateway.js');
var query = require('./query.js');
var invoke = require('./invoke.js');
//var blockListener = require('./blocklistener.js');

hfc.addConfigFile('config.json');
var host = 'localhost';
var port = 3000;
var username = "";
var orgName = "";
var channelName = hfc.getConfigSetting('channelName');
var chaincodeName = hfc.getConfigSetting('chaincodeName');
var peers = hfc.getConfigSetting('peers');
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATIONS ///////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(function(req, res, next) {
	logger.info(' ##### New request for URL %s',req.originalUrl);
	return next();
});

//wrapper to handle errors thrown by async functions. We can catch all
//errors thrown by async functions in a single place, here in this function,
//rather than having a try-catch in every function below. The 'next' statement
//used here will invoke the error handler function - see the end of this script
const awaitHandler = (fn) => {
	return async (req, res, next) => {
		try {
			await fn(req, res, next)
		} 
		catch (err) {
			next(err)
		}
	}
}

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('***************  Listening on: http://%s:%s  ******************',host,port);
server.timeout = 240000;

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////




///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// GET METHODS //////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/************************************************************************************
 * Health check - can be called by load balancer to check health of REST API
 ************************************************************************************/

app.get('/health', awaitHandler(async (req, res) => {
	res.sendStatus(200);
}));

/************************************************************************************
 * Enroll an admin user and import it into the Fabric wallet
 ************************************************************************************/

app.get('/users/admin', awaitHandler(async (req, res) => {
	logger.info('================ GET on endpoint /users/admin');
	logger.info('GET on /users/admin. Params: ' + JSON.stringify(req.query));
	let args = req.query;
    let response = await gateway.enrollAdminForOrg(args);
    //await gateway.adminGateway();
    res.json({success: true, message: response});
	logger.info('##### GET on /users/admin - completed');
}));

/************************************************************************************
 * List all users enrolled with the CA for a specific org
 ************************************************************************************/

app.get('/users/enrolled', awaitHandler(async (req, res) => {
	logger.info('================ GET on endpoint /users/enrolled');
	logger.info('GET on /users/enrolled. Params: ' + JSON.stringify(req.query));
	let args = req.query;
    let response = await gateway.getUsersForOrg(args);
    res.json({success: true, message: response});
	logger.info('##### GET on /users/enrolled - completed');
}));

/************************************************************************************
 * Print the organisations contained in env.sh
 ************************************************************************************/

app.get('/env/orgs', awaitHandler(async (req, res) => {
	logger.info('================ GET on endpoint /env/orgs');
    let response = await gateway.getOrgsFromEnv();
    res.json({success: true, message: response});
	logger.info('##### GET on /env/orgs - completed');
}));

/************************************************************************************
 * Print the port numbers used by peers, orderers, CA's, etc.
 ************************************************************************************/

app.get('/env/ports', awaitHandler(async (req, res) => {
	logger.info('================ GET on endpoint /env/ports');
	logger.info('GET on /env/ports. Params: ' + JSON.stringify(req.query));
	let args = req.query;
    let response = await gateway.getPorts(args);
    res.json({success: true, message: response});
	logger.info('##### GET on /env/ports - completed');
}));

/************************************************************************************
 * Print the organisations contained in configtx.yaml
 ************************************************************************************/

app.get('/configtx/orgs', awaitHandler(async (req, res) => {
	logger.info('================ GET on endpoint /configtx/orgs');
    let response = await gateway.getOrgsFromConfigtx();
    res.json({success: true, message: response});
	logger.info('##### GET on /configtx/orgs - completed');
}));

/************************************************************************************
 * Print the channel profiles contained in configtx.yaml
 ************************************************************************************/

app.get('/configtx/profiles', awaitHandler(async (req, res) => {
	logger.info('================ GET on endpoint /configtx/profiles');
    let response = await gateway.getProfilesFromConfigtx();
    res.json({success: true, message: response});
	logger.info('##### GET on /configtx/profiles - completed');
}));

/************************************************************************************
 * Print the details of the Fabric network, as seen by the Fabric client
 ************************************************************************************/

app.get('/networks', awaitHandler(async (req, res) => {
	logger.info('================ GET on endpoint /networks');
    let response = await gateway.listNetwork();
    res.json({success: true, message: response});
	logger.info('##### GET on networks - completed');
}));

/************************************************************************************
 * Chaincode methods. These are here to test the connection profile, to make sure
 * the REST API is able to interact with the chaincode
 *
 * The /users method below must be called before this /marbles function
 ************************************************************************************/

// Query the chaincode
app.get('/marbles', awaitHandler(async (req, res) => {
	logger.info('================ GET on Marbles');
	let args = {};
	let fcn = "read_everything";

    logger.info('##### GET on Marbles - username : ' + username);
	logger.info('##### GET on Marbles - userOrg : ' + orgName);
	logger.info('##### GET on Marbles - channelName : ' + channelName);
	logger.info('##### GET on Marbles - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Marbles - fcn : ' + fcn);
	logger.info('##### GET on Marbles - args : ' + JSON.stringify(args));
	logger.info('##### GET on Marbles - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// POST METHODS /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/************************************************************************************
 * Register and enroll user. A user must be registered and enrolled before any queries
 * or transactions can be invoked
 ************************************************************************************/

app.post('/users', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /users');
	let args = req.body;
	username = req.body.username;
	orgName = req.body.org;
	logger.info('##### POST on Users- args : ' + JSON.stringify(args));
	let response = await connection.getRegisteredUser(args, true);
	logger.info('##### POST on Users - returned from registering the username %s for organization %s', username, orgName);
    logger.info('##### POST on Users - getRegisteredUser response secret %s', response.secret);
    logger.info('##### POST on Users - getRegisteredUser response message %s', response.message);
    if (response && typeof response !== 'string') {
        logger.info('##### POST on Users - Successfully registered the username %s for organization %s', username, orgName);
		logger.info('##### POST on Users - getRegisteredUser response %s', response);
		// Now that we have a username & org, we can start the block listener
		//await blockListener.startBlockListener(channelName, username, orgName, wss);
		res.json(response);
	} else {
		logger.error('##### POST on Users - Failed to register the username %s for organization %s with::%s', username, orgName, response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Chaincode methods. These are here to test the connection profile, to make sure
 * the REST API is able to interact with the chaincode
 *
 * The /users method below must be called before this /marbles function
 ************************************************************************************/

app.post('/marbles', awaitHandler(async (req, res) => {
	logger.info('================ POST on Marbles');
	var args = ["m777777777772", "red", "35", "o8888888888888888881", "United Marbles"];
	var fcn = "init_marble";

    logger.info('##### POST on Marbles - username : ' + username);
	logger.info('##### POST on Marbles - userOrg : ' + orgName);
	logger.info('##### POST on Marbles - channelName : ' + channelName);
	logger.info('##### POST on Marbles - chaincodeName : ' + chaincodeName);
	logger.info('##### POST on Marbles - fcn : ' + fcn);
	logger.info('##### POST on Marbles - args : ' + util.inspect(args));
	logger.info('##### POST on Marbles - peers : ' + peers);

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));

/************************************************************************************
 * Add a new organisation. This API call does a number of things:
 *      Adds the org to configtx.yaml
 *      Adds the org to the env.sh file that is used to configure the Fabric network
 *      Adds the org to the consortium defined in the profiles section in configtx.yaml
 *      Updates the system channel configuration block with the new consortium profile
 *
 ************************************************************************************/

app.post('/orgs', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /orgs');
	let args = req.body;
	logger.info('##### POST on orgs - args : ' + JSON.stringify(args));
	let response = await gateway.addOrg(args);
	logger.info('##### POST on orgs - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on orgs failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Add a new org to env.sh
 ************************************************************************************/

app.post('/env/orgs', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /env/orgs');
	let args = req.body;
	logger.info('##### POST on env/orgs - args : ' + JSON.stringify(args));
	let response = await gateway.addOrgToEnv(args);
	logger.info('##### POST on env/orgs - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on env/orgs failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Prepare the Kubernetes environment for a new org:
 *      Creates a new namespace in the EKS cluster for the org
 *      Creates the necessary directory structure for the new org's MSP
 *      Creates the EKS PV & PVCs (persistent volumes), mapping to the new org's MSP
 ************************************************************************************/

app.post('/orgs/setup', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /orgs/setup');
	let args = req.body;
	logger.info('##### POST on orgs/setup - args : ' + JSON.stringify(args));
	let response = await gateway.setupOrg(args);
	logger.info('##### POST on orgs/setup - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on orgs/setup failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Add a new profile to configtx.yaml
 ************************************************************************************/

app.post('/configtx/profiles', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /configtx/profiles');
	let args = req.body;
	logger.info('##### POST on /configtx/profiles - args : ' + JSON.stringify(args));
	let response = await gateway.addProfileToConfigtx(args);
	logger.info('##### POST on /configtx/profiles - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /configtx/profiles failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Generate a new channel transaction config using a profile in configtx.yaml
 ************************************************************************************/

app.post('/configtx/channelconfigs', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /configtx/channelconfig');
	let args = req.body;
	logger.info('##### POST on configtx/channelconfig - args : ' + JSON.stringify(args));
	let response = await gateway.createTransactionConfig(args);
	logger.info('##### POST on configtx/channelconfig - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on configtx/channelconfig failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Create a new channel
 ************************************************************************************/

app.post('/channels', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /channel');
	let args = req.body;
	logger.info('##### POST on channel - args : ' + JSON.stringify(args));
	let response = await gateway.createChannel(args);
	logger.info('##### POST on channel - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on channel failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Join a new channel
 ************************************************************************************/

app.post('/channels/join', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /channel/join');
	let args = req.body;
	logger.info('##### POST on channel/join - args : ' + JSON.stringify(args));
	let response = await gateway.joinChannel(args);
	logger.info('##### POST on channel/join - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on channel/join failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Install chaincode on all peers belonging to an org
 ************************************************************************************/

app.post('/channels/chaincode/install', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /channels/chaincode/install');
	let args = req.body;
	logger.info('##### POST on /channels/chaincode/install - args : ' + JSON.stringify(args));
	let response = await gateway.installChaincode(args);
	logger.info('##### POST on /channels/chaincode/install - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /channels/chaincode/install failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Instantiate chaincode on a channel
 ************************************************************************************/

app.post('/channels/chaincode/instantiate', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /channels/chaincode/instantiate');
	let args = req.body;
	logger.info('##### POST on /channels/chaincode/instantiate - args : ' + JSON.stringify(args));
	let response = await gateway.instantiateChaincode(args);
	logger.info('##### POST on /channels/chaincode/instantiate - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /channels/chaincode/instantiate failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Start a CA for the new org
 ************************************************************************************/

app.post('/orgs/ca', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /orgs/ca');
	let args = req.body;
	logger.info('##### POST on /orgs/ca - args : ' + JSON.stringify(args));
	let response = await gateway.startCA(args);
	logger.info('##### POST on /orgs/ca - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /orgs/ca failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Register the new org
 ************************************************************************************/

app.post('/orgs/register', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /orgs/register');
	let args = req.body;
	logger.info('##### POST on /orgs/register - args : ' + JSON.stringify(args));
	let response = await gateway.startRegisterOrg(args);
	logger.info('##### POST on /orgs/register - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /orgs/register failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Register the new peer
 ************************************************************************************/

app.post('/peers/register', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /peers/register');
	let args = req.body;
	logger.info('##### POST on /peers/register - args : ' + JSON.stringify(args));
	let response = await gateway.startRegisterPeer(args);
	logger.info('##### POST on /peers/register - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /peers/register failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Start the new peer. This generates the MSP for the peer
 ************************************************************************************/

app.post('/peers/start', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /peers/start');
	let args = req.body;
	logger.info('##### POST on /peers/start - args : ' + JSON.stringify(args));
	let response = await gateway.startPeer(args);
	logger.info('##### POST on /peers/start - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /peers/start failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Start the remote peer in a remote AWS account, separate from the account that
 * hosts the main Fabric orderer.
 ************************************************************************************/

app.post('/orgs/remote/setup', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /orgs/remote/setup');
	let args = req.body;
	logger.info('##### POST on /orgs/remote/setup - args : ' + JSON.stringify(args));
	let response = await gateway.setupRemoteOrg(args);
	logger.info('##### POST on /orgs/remote/setup - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /orgs/remote/setup failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Start the remote peer in a remote AWS account, separate from the account that
 * hosts the main Fabric orderer.
 ************************************************************************************/

app.post('/peers/remote/start', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /peers/remote/start');
	let args = req.body;
	logger.info('##### POST on /peers/remote/start - args : ' + JSON.stringify(args));
	let response = await gateway.startRemotePeer(args);
	logger.info('##### POST on /peers/remote/start - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /peers/remote/start failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Start the new Fabric network. This does the same as ./fabric-main/start-fabric.sh
 ************************************************************************************/

app.post('/fabric/start', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /fabric/start');
	let args = req.body;
	logger.info('##### POST on /fabric/start - args : ' + JSON.stringify(args));
	let response = await gateway.startFabricNetwork(args);
	logger.info('##### POST on /fabric/start - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /fabric/start failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Stop the new Fabric network. This does the same as ./fabric-main/stop-fabric.sh
 ************************************************************************************/

app.post('/fabric/stop', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /fabric/stop');
	let args = req.body;
	logger.info('##### POST on /fabric/stop - args : ' + JSON.stringify(args));
	let response = await gateway.stopFabricNetwork(args);
	logger.info('##### POST on /fabric/stop - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /fabric/stop failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Upload the MSP for a specific org to S3
 ************************************************************************************/

app.post('/orgs/msp/upload', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /orgs/msp/upload');
	let args = req.body;
	logger.info('##### POST on /orgs/msp/upload - args : ' + JSON.stringify(args));
	let response = await gateway.uploadMSPtoS3(args);
	logger.info('##### POST on /orgs/msp/upload - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /orgs/msp/upload failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Download the MSP for a specific org from S3
 ************************************************************************************/

app.post('/orgs/msp/download', awaitHandler(async (req, res) => {
	logger.info('================ POST on endpoint /orgs/msp/download');
	let args = req.body;
	logger.info('##### POST on /orgs/msp/download - args : ' + JSON.stringify(args));
	let response = await gateway.downloadMSPfromS3(args);
	logger.info('##### POST on /orgs/msp/download - response %s', util.inspect(response));
    if (response && typeof response !== 'string') {
		res.json(response);
	} else {
		logger.error('##### POST on /orgs/msp/download failed: %s', response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Error handler
 ************************************************************************************/

app.use(function(error, req, res, next) {
	res.status(500).json({ error: error.toString() });
});

