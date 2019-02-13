 'use strict';
  // require node core modules
  const request = require('request');
  const aws=require('aws-sdk');
  const dynamodb = new aws.DynamoDB;
  const uuidv4=require('uuid/v4');
  const coordserver="https://oyqn4ea086.execute-api.us-east-1.amazonaws.com/default/CoordServer-dev-getCoordServer";

  //ten websites that used for random website

  module.exports.getwebinfo = async function (event) {
      //step1: user calls the indirection server
      console.log("function starts");
      console.log('Request Headers:', JSON.stringify(event.headers.cookie));

      if(event.path && event.httpMethod){
        if(event.httpMethod=="POST"){
          var listOfPaths=event.path.split('/');
          var commands=listOfPaths[listOfPaths.length-1].trim();
          if(commands == "getLog"){
            return "not implemented";
          }else if(commands == "getMapping"){
            let params = {
              TableName: 'userids'
            }
            let getMappingPromise = new Promise((resolve, reject) => {
                dynamodb.scan(params, function(err,data){
                if(err){
                  console.log("Unable to put. Error:", JSON.stringify(err, null, 2));
                }else{
                  console.log("scan table"+ JSON.stringify(data["Items"]));
                  resolve(data["Items"]);
                }
              });
            });
            let info= await getMappingPromise;
            return JSON.stringify(info);
          }else if(commands == "remapAllClients"){
            //verify same hostname or port?
            let params = {
              TableName: 'userids'
            }
            let getMappingPromise = new Promise((resolve, reject) => {
                dynamodb.scan(params, function(err,data){
                if(err){
                  console.log("Unable to put. Error:", JSON.stringify(err, null, 2));
                }else{
                  resolve(data["Items"]);
                }
              });
            });
            let info= await getMappingPromise;
            for(let i=0; i<info.length;i++){
              let keyinfo=info[i]["userid"]["S"];
              let reMappingparams= {
                TableName: 'userids',
                Item:{
                  "userid" :{
                    S : keyinfo
                  },
                  "hostname" :{
                    S : " "
                  },
                  "port" :{
                    N : "000"
                  }
                }
              };
              let reMappingPromise = new Promise((resolve, reject) => {
                  dynamodb.putItem(reMappingparams, function(err,data){
                  if(err){
                    console.log("Unable to put. Error:", JSON.stringify(err, null, 2));
                  }else{
                    console.log("remapAllClients successfully!");
                    resolve(data);
                  }
                });
              });
              let deleteinfo=await reMappingPromise;
            }
            return "remapping success";
          }else if(commands == "deleteMapping"){
            if(event.body.hostname && event.body.port){
              let hostAddress=event.body.hostname;
              let portNum=JSON.stringify(event.body.port);
              console.log(hostAddress);
              console.log(portNum);
              let deleteMappingscan = {
                TableName: "userids",
                ScanFilter: {
                  "hostname" : {
                    "AttributeValueList":[ {"S": hostAddress} ],
                    "ComparisonOperator": "EQ"
                  },
                  "port" : {
                    "AttributeValueList":[ {"N": portNum} ],
                    "ComparisonOperator": "EQ"
                  },
                }
              };
              let deleteMappingPromise = new Promise((resolve, reject) => {
                  dynamodb.scan(deleteMappingscan, function(err,data){
                  if(err){
                    console.log("hostname and port doesn't exist");
                  }else{
                    console.log("information fetch success")
                    resolve(data);
                  }
                });
              });
              let deleteinfo=await deleteMappingPromise;
              if(deleteinfo["Items"][0]){
                let userinfo=deleteinfo["Items"][0]["userid"]["S"];
                console.log("userid is "+userinfo);
                let deleteparams= {
                  TableName: 'userids',
                  Key:{
                    "userid" :{
                      S : userinfo
                    }
                  }
                };
                let deletePromise = new Promise((resolve, reject) => {
                    dynamodb.deleteItem(deleteparams, function(err,data){
                      if(err){
                        console.log("Unable to delete");
                      }else{
                        console.log("delete clients successfully!");
                        resolve(data);
                      }
                    });
                  });
                  let lastinfo=await deletePromise;
                  return "delete Mapping success";
              }else{
                return "delete mapping fails: hostname and port pairs doesn't exist";
              }
            }
          }else if(commands == "setState" ){
            return "not implemented";
          }else{
            return "command doesn't support"; 
          }
        }
      }

      var findCookie = "userId" + "=";
      var flag=false;
      //boolean variable use for checking whether find cookie in headers
      var noCookie=true;
      var noAddress=true;
      //boolean variable use for checking whether first time user visit server
      var needToCall=false;
      var temp="";
      var siteDest="";
      var cookieId="";
      if(event.headers && event.headers.cookie){
      var cookie = event.headers.cookie; //retrieve from header
      var listOfCookies = cookie.split(';');
      for (var i = 0; i < listOfCookies.length; i++) {
        if(listOfCookies[i].trim().indexOf(findCookie) === 0) {
          flag=true;
          temp = listOfCookies[i].replace(findCookie, '');
          break;
        }
      }

      temp = temp.trim();
      //find user id in cookies
      //stesearchPromise: Indirection server check for cookieid from database
      if(flag && event.headers.cookie){
         noCookie=false;
    	   cookieId=temp;
         var params = {
           TableName: 'userids',
           Key :{
             "userid" :{
               S : cookieId
             }
           }
         };
         let searchPromise = new Promise((resolve, reject)=> {
           dynamodb.getItem(params, function(err,data){
           if(err){
             console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
           }else{
             if(data["Item"]){
               if(data["Item"]["hostname"]){
               noCookie=false;
               //checking is valid website
               siteDest=data["Item"]["hostname"]["S"];
               let pattern=/^(https:)+/i
               let n=siteDest.search(pattern);
               console.log(JSON.stringify(n));
               if(n==0){
                 noAddress=false;
               }else{
                 noAddress=true;
               }
               console.log("Query succeed."+ JSON.stringify(siteDest));
             }else{
               noCookie=false;
               noAddress=true;
             }
             //if cookieId has website stored in database
             }else{
               //if cookieId doesn't have valuess
               noCookie=false;
               noAddress=true;
             }
             resolve(siteDest);
           }
         });
       });
        siteDest=await searchPromise;
      }};

      //SteinsertPromise: generate new cookie if either user don't have cookie id or cannot find website
      //call coordinate server to assign to new website
      if(noCookie && noAddress){
        console.log("Don't have userid and no address");
        cookieId=uuidv4();
        console.log("cookieId is "+cookieId);
        console.log("don't have cookie and don't have address");
        needToCall=true;
      }else if(!noCookie && noAddress){
        needToCall=true;
        console.log("have cookie but no address");
      }else{
        needToCall=false;
        console.log("have cookie and have address");
      }

      if(needToCall){
        console.log("new user or existing user don't have address");
        //step4: indirection server calls coordinate server
        let handlerResponse = {
          'statusCode': 200,
          'headers': {
            'Content-Type': 'text/html',
          },
          'body': "HTML will be here"
        }
        let responseCoordServer = new Promise( (resolve, reject) => {
             var request = require('request');
             request(coordserver, function (error, response, body) {
              console.log('error:', error); // Print the error if one occurred
               // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
               // console.log('body:', body); // Print the HTML for the Google homepage.
               handlerResponse.body = body
               handlerResponse.statusCode = response.statusCode
               handlerResponse.headers = {
                   'Content-Type': 'text/html'
               }
               resolve(handlerResponse);
             })
         });
         let responseNum = await responseCoordServer;
         console.log(responseNum.body);
        //step5: receive data from coordinate server
        var siteDestChoice=JSON.parse(responseNum.body)["hostname"];
        console.log(siteDestChoice);
        var params2 = {
          TableName: 'userids',
          Item :{
            "userid" :{
              S : cookieId
            },
            "hostname" :{
              S : siteDestChoice
            },
            "port" :{
              N : "443"
            }
          }
        };

      let insertPromise = new Promise((resolve, reject) => {
          dynamodb.putItem(params2, function(err,data){
          if(err){
            console.log("Unable to put. Error:", JSON.stringify(err, null, 2));
          }else{
            console.log("Query succeed."+ JSON.stringify(data));
            resolve(siteDestChoice);
          }
        });
      });

      siteDest= await insertPromise;
      var cookieInfo= "userId="+cookieId;
      handlerResponse = {
        'statusCode': 200,
        'headers': {
          'Content-Type': 'text/html',
          'Set-Cookie': cookieInfo
        },
        'body': "HTML will be here"
      }

      //step6: store userid and website address in database

      //other operations:
      //remapAllClients():  Remove all existing entries in the destination table.
      //This will force any new requests to ask the coordination server where to go.

      //moveToDestination(): Given a cookie, update the destination to the given destination for that cookie.
      //This will simply redirect a single user to a different server.

      //getLog(): gets the log file for the indirection server.
      //for now you can return “Not implemented” or something like that.

      //getMapping(): Returns all the mappings from user(cookie) to destination server

      //deleteMapping(): Deletes all mappings to the given destination server
      //(hostname and port) so all users who are assigned to this
      //“hostname:port” destination will go somewhere else next time.
      //Parameters: {"hostname”:...,"port”:…}

      //setState(): Sets the state for this indirection server
      //Parameters: {'newState': newState}
      //States can be: OFFLINE, FORWARD, ONLINE, STAGED
      //store the state in the dynamoDB and we may use it later.


      // This is what a good response will look like
      let responsePromise = new Promise( (resolve, reject) => {
           var request = require('request');
           request(siteDest, function (error, response, body) {
             // console.log('error:', error); // Print the error if one occurred
             // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
             // console.log('body:', body); // Print the HTML for the Google homepage.

             handlerResponse.body = body
             handlerResponse.statusCode = response.statusCode
             handlerResponse.headers = {
                 'Content-Type': 'text/html',
                 'Set-Cookie': cookieInfo
             } // response.headers <--- Using this causes errors probably due to Cookie setting (?)
             resolve(handlerResponse)
           });
       })
      let resp = await responsePromise // Wait for it using async/await
      return  resp;
    }else{
      console.log("existing user");
      let handlerResponse = {
        'statusCode': 200,
        'headers': {
          'Content-Type': 'text/html',
        },
        'body': "HTML will be here"
      }
      let responsePromise = new Promise( (resolve, reject) => {
           var request = require('request');
           request(siteDest, function (error, response, body) {
             // console.log('error:', error); // Print the error if one occurred
             // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
             // console.log('body:', body); // Print the HTML for the Google homepage.

             handlerResponse.body = body
             handlerResponse.statusCode = response.statusCode
             handlerResponse.headers = {
                 'Content-Type': 'text/html',
             } // response.headers <--- Using this causes errors probably due to Cookie setting (?)
             resolve(handlerResponse)
           });
       })
      let resp = await responsePromise // Wait for it using async/await
      return resp // Return the real response
    }
  }



  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
