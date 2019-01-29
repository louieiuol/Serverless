
  'use strict';

  // require node core modules
  const request = require('request');
  const aws=require('aws-sdk');
  const dynamodb = new aws.DynamoDB;
  const uuidv4=require('uuid/v4');
  const siteDests=[
    "https://www.cnn.com",
    "https://www.google.com",
    "https://www2.gmu.edu",
    "https://www.baidu.com",
    "https://www.youtube.com",
    "https://www.yahoo.com",
    "https://www.reddit.com",
    "https://www.github.com",
    "https://www.linkedin.com",
    "https://www.apple.com"
  ];

  module.exports.getwebinfo = async function (event) {

      // Usage: call this with a query string s=https://www.cnn.com
      // and the code will proxy to CNN
      console.log("function starts");
      console.log('Request Headers:', JSON.stringify(event.headers.cookie));

      var findCookie = "userId" + "=";
      var flag=false;
      var firsttime=true;
      var temp="";
      var siteDest="";
      var cookieId="";
      if(event.headers && event.headers.cookie){
      var cookie = event.headers.cookie; //retrieve from api
      var listOfCookies = cookie.split(';');

      for (var i = 0; i < listOfCookies.length; i++) {
        if(listOfCookies[i].trim().indexOf(findCookie) === 0) {
          flag=true;
          temp = listOfCookies[i].replace(findCookie, '');
          break;
        }
      }

      temp = temp.trim();
      console.log('cookie: ' + temp);
      // TODO: Get a Cookie value here to get an ID for the user who invoked
      //          this function
      if(flag && event.headers.cookie){
    	   cookieId=temp;
         console.log("cookie id is "+ cookieId);
         var params = {
           TableName: 'userids',
           Key :{
             "userid" :{
               S : cookieId
             }
           }
         };
         let p2 = new Promise( (resolve, reject) => {
           dynamodb.getItem(params, function(err,data){
           if(err){
             console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
           }else{
             if(data["Item"]["address"]){
               firsttime=false;
               siteDest=data["Item"]["address"]["S"];
               console.log("Query succeed."+ JSON.stringify(siteDest));
             }
             resolve(siteDest);
           }
         });
       });
        siteDest=await p2;
      }};

      if(firsttime){
        console.log("Don't have userid");
        cookieId=uuidv4();
        console.log("cookieId is "+cookieId);
        let choice=Math.floor((Math.random()*10)+1)-1;
        console.log("choice is "+choice);
        var siteDestChoice=siteDests[choice];
        var params2 = {
          TableName: 'userids',
          Item :{
            "userid" :{
              S : cookieId
            },
            "address" :{
              S : siteDestChoice
            }
          }
        };

        let p3 = new Promise( (resolve, reject) => {
          dynamodb.putItem(params2, function(err,data){
          if(err){
            console.log("Unable to put. Error:", JSON.stringify(err, null, 2));
          }else{
            console.log("Query succeed."+ JSON.stringify(data));
            resolve(siteDestChoice);
          }
        });
      });
        siteDest= await p3;
      }
      var cookieInfo= "userId="+cookieId;
      let handlerResponse = {
        'statusCode': 200,
        'headers': {
          'Content-Type': 'text/html',
          'Set-Cookie': cookieInfo
        },
        'body': "HTML will be here"
      }

      // This is what a good response will look like
      let p = new Promise( (resolve, reject) => {
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
      let resp = await p // Wait for it using async/await
      return resp // Return the real response
  }
  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
