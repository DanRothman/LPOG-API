
  ///////////////// formatDate Function ///////////

  module.exports = {

  connected_client:null,
  
  
  
  createSSHCredentials:function(conn_props){
    var ssh = new Object()
    ssh.host = conn_props.get("ssh.host");                                  
    ssh.user = conn_props.get("ssh.user");                                  
    ssh.password = conn_props.get("ssh.password");                                                          //'Dan123!';
    return ssh;
  },

  createMySQLCredentials:function(conn_props){
    var server_mode = conn_properties.get("general.server_mode");

    var msc = new Object();
    msc.host = conn_props.get("sql_" + server_mode + ".host");                                                               //'127.0.0.1';
    msc.port = conn_props.get("sql_" + server_mode + ".port");
    msc.user = conn_props.get("sql_" + server_mode + ".user");
    msc.password = conn_props.get("sql_" + server_mode + ".password");
    msc.database = conn_props.get("sql_" + server_mode + ".database");
    return msc
  },
  
  runSQL:function (client,req,res,mssh){
      
      try{
          sqlstatement = req.param("sqlstatement")==null ? "" : req.param("sqlstatement");
          //if (sqlstatement.substring(0,6).toUpperCase()=="SELECT"){
             executeQuery(sqlstatement,client,res,mssh);
          //}
        }catch(e){
          console.log("illegal request : " + sqlstatement," in runSQL");
        } 
  },

  getMaxFacingPosByShelf:function(client, req, res, mssh){
    /*
          Create OR REPLACE VIEW maxFacingPositionByShelf AS
          select shelfID, max(facingShelfRelativeAddress) as maxposition from displaymatrix group by shelfID;
          dbGetMaxFacingPositionByShelf?shelfid=28
    */
      var shelfID = req.param("shelfid");
      var whereClause = "WHERE " + "shelfID="+shelfID;
      var q = "SELECT * FROM maxFacingPositionByShelf " + whereClause;
      try{
          executeQuery(q,client,res,mssh);
      }catch(e){
          console.log("Error running sql = ",q, " in getMaxFacingPosByShelf");
      } 

  },

  getMaxShelfLevelByFixture:function(client, req, res, mssh){

      var displayfixtureID = req.param("fixtureid");
      var whereClause = "WHERE " + "displayfixtureID="+displayfixtureID;
      var q = "SELECT * FROM maxShelfLevelByFixture " + whereClause;
      try{
          executeQuery(q,client,res,mssh);
      }catch(e){
        console.log("Error running sql = ",q, " in getMaxFacingPosByShelf");
      } 

  },

  getRecordsByID: function (id, tablename, lookupTableName, orderByClause, client, filter, req,res,mssh) {
        var whereClause = "";
        console.log("id = ",id)
        console.log("tablename = ",tablename)
        console.log("lookupTableName = ",lookupTableName)
        console.log("orderbyClause = ",orderByClause)
        console.log("filter = ",filter)

        if (id != null && id.toUpperCase() != "ALL"){
            whereClause = " WHERE " + lookupTableName + "ID=" + id 
            console.log("have a whereClause, and whereClause = ")
        }

        if (filter != ""){
           if (whereClause != ""){
             whereClause += " AND " + filter;
           }else{
             whereClause = "WHERE " + filter;
           }
        }

        var q = "SELECT * FROM " + tablename + " " + whereClause + " " + orderByClause + ";";
        console.log("getRecordByID sql = ", q)
        try{
          //for(i=0;i<15;i++)
        	executeQuery(q,client,res,mssh);
      	}catch(e){
           console.log("Error running sql = ",q), " in getRecordsByID";
      	}	
  },

  getRecordsByView:function(tablename,client,req,res,mssh){
      var q = "SELECT * FROM " + tablename + ";"
      try{
          executeQuery(q,client,res,mssh);
      }catch(e){
        console.log("Error running sql = ",q, " in getRecordsByView");
      } 
  },
  insertRecords: function (tablename,client, req,res) {
  	// var sql = "INSERT INTO customers (name, address) VALUES ('Company Inc', 'Highway 37')";
  	//console.log("YOUR PARAMS = " +parent+"id:" + req.param(parent + "id"));
  	
  	try{
        //fields is a stringified JSONObject
        //var fieldsAndValues = req.param("fields")

         var fieldsAndValues = req.param("fields")
         console.log("In insertRecords")
         console.log("fieldsAndValues=",fieldsAndValues)
         var fvMap = JSON.parse(fieldsAndValues)
         var q = 'INSERT INTO '+ tablename +' SET ?'
         client.query(q, fvMap, (qerr, qres) => {
            if(qerr) {
              console.log("THERE WAS AN ERROR IN EXECUTEINSERT")
              console.log("error = ", qerr)
              console.log("this is only a printout, the server is still running")
              res.send([{code:"error"}]);
              return
              //throw qerr;
            }
            console.log("query=",q)
            console.log("Insert successfull!!")
            res.send([{code:"done"}]);
          });
          console.log("Exiting executeInsert")
    }catch(e){
      console.log("Error running sql = ",q," in insertRecords");
    }	                
  },
  multiInsertRecords: function (tablename,client, req,res) {
    var fvMap = JSON.parse(req.param("fields")).recs 
    
    console.log("fvMap=",fvMap)
    
    if (fvMap.length <= 0){
      res.send([{code:'error'}])
      return
    } 

    var field_list = "(";
    var field_list_Array = []
    var field_values = "";

    //build field_list, and field_list_array -- field_list_array facilitates getting data from json array
    for (var p in fvMap[0]) {
      field_list+=("`"+p+"`,");
      field_list_Array.push(p)
    }
    field_list = field_list.substring(0,field_list.length-1)+")"
    for (var i=0; i < fvMap.length;i++){
      field_values+="("
      for (f in field_list_Array){
        var val = fvMap[i][field_list_Array[f]]
        var valOut = val + ""
        valOut = "'"+valOut+"'"
       
        field_values += (valOut + ",")
      }
      field_values = field_values.substring(0,field_values.length-1)+"),"
    }
    field_values = field_values.substring(0,field_values.length-1)

    var q = 'INSERT INTO '+ tablename + " " + field_list + ' VALUES ' + field_values

    console.log("q=",q)


    try{
        client.query(q)
        console.log("Exiting MultiInsert")
    }catch(e){
        console.log("Error running sql = ",q," in multiInsertRecords");
    }

    //console.log("fvMap=",fvMap)
    res.send([{code:'done'}]);
  },
    //////// FOR UPDATES //////////////
  updateRecords:function(tablename,client,req,res){
         var tLookup = tablename.substring(0,tablename.length-1);
         var fieldsAndValues = req.param("fields");
         var id = req.param("id");
         console.log("In executeupdate1");
         console.log("fieldsAndValues=",fieldsAndValues);
         var fvMap = JSON.parse(fieldsAndValues);

         //UPDATE `members` SET `full_names` = 'Janet Smith Jones', `physical_address` = 'Melrose 123' WHERE `membership_number` = 2;

         //connection.query('UPDATE users SET ? WHERE UserID = :UserID',{UserID: userId, Name: name})
         var q = 'UPDATE '+ tablename +' SET ? WHERE ' + tLookup + 'ID = ' + id;

         client.query(q, fvMap, (qerr, qres) => {
            if(qerr) {
              console.log("THERE WAS AN ERROR IN EXECUTE UPDATE");
              console.log("EXECUTING ",q);
              console.log("error = ", qerr);
              console.log("this is only a printout, the server is still running");
              res.send([{code:'error'}]);
              return;
              //throw qerr;
            }
            console.log("query=",q);
            console.log("UPDATE successfull!!");
            res.send([{code:'done'}]);
          });
          console.log("Exiting executeUpdate");
  },

  //http://localhost:8080/dbUpdateFacingMerchandiseData?shelfid=1&startposition=5&endposition=10&merchandiseitemid=6&fromdate=2019-12-29-10:22:00;  

  updateFacingMerchandiseData(client,req,res,mssh){
    console.log("Executing update facings Merchandise Data function");
    /* Begin transaction */
    var shelfID = req.param("shelfid");
    var startPosition = req.param("startposition");
    var endPosition = req.param("endposition");
    var fromDate = req.param("fromdate");


    //var merchandiseItemID = req.param("merchandiseitemid");
    var productID = req.param("productid");

    var selectFacingsStatement = "select * from facings where shelfID=" + shelfID + 
                                 " AND shelfRelativeAddress >=" + startPosition +
                                 " AND shelfRelativeAddress <=" + endPosition;

    console.error("shelfid =", shelfID);
    console.error("startposition =",startPosition);
    console.error("endposition =",endPosition);

    client.beginTransaction(function(err) {
        if (err) { 
          throw err; 
          res.send("[error]");
          return;
        }
        
        client.query(selectFacingsStatement, function(err, result) {
         
          if (err) { 
            client.rollback(function() {
              res.send("[error]");
              throw err;              
            });
            return;
          }
          

          /*var insertLinkStatement = "INSERT INTO `facingmerchandiselinks`" +
          "(facingID,merchandiseitemID,fromDate) VALUES ";*/
          var insertLinkStatement = "INSERT INTO `facingmerchandiselinks`" +
          "(facingID,productID,fromDate) VALUES ";
          
          // build values list
          var valueList="";
          for (var i=0; i < result.length;i++){
            //console.error("item=",result[i]);
             /*var clause =  "(" + result[i]["facingID"] + "," +
                                 merchandiseItemID + "," +
                                 "'" + fromDate + "'),";
             */
             var clause =  "(" + result[i]["facingID"] + "," +
                                 productID + "," +
                                 "'" + fromDate + "'),";
             valueList += clause;                    
          }
          valueList = valueList.substring(0,valueList.length-1);
          insertLinkStatement += valueList;

          console.log("**********************************************************");
          console.log("INSERT LINKS STATEMENT = ",insertLinkStatement);
          
          // this is the rest of the function to get working
          client.query(insertLinkStatement, function(err, result) {
            if (err) { 
              client.rollback(function() {
                res.send("[error]");
                throw err;
              });
              return;
            } 

            client.commit(function(err) {
              if (err) { 
                client.rollback(function() {
                  res.send("[error]");
                  throw err;
                });
                return;
              }
              console.log('Transaction Complete.');
              res.send(result);
              
            });
          });
        });

    });
    /* End transaction */


  },

  //dbInsertFacings?facing={<<fieldname>>:<<value>>,..,<<fieldname>>:<<value>>}&numberoffacings=<<n>>
  // example:
  //
  //dbInsertFacings?facing={"shelfID":5,"shelfRelativeAddress":2,"depth":48,"width":12,"height":12,"activationDate":"2018-12-31"}&numberoffacings=5
  //http://localhost:8080/dbinsertfacings?facing={"shelfID":1,"shelfRelativeAddress":2,"depth":999999,"width":12,"height":12,"activationDate":"2019-12-01"}&numberoffacings=1

 //http://localhost:8080/dbinsertfacings?facing={"shelfID":1,"shelfRelativeAddress":2,"depth":999999,"width":12,"height":12,"activationDate":"2019-12-01"}&numberoffacings=1


 insertFacings:function(client,req,res,mssh){
    console.log("Executing insert facings function");
    var facing   = JSON.parse(req.param("facing"));
    var shelfPosition = facing.shelfRelativeAddress;
    var nFacings = req.param("numberoffacings");
    
    /*  SQL TO Bump positions up to make room for the new records */
    var whereClause = "WHERE shelfID=" + facing.shelfID + " AND shelfRelativeAddress>=" + shelfPosition;

    var updateFacingPositionsStatement = "UPDATE facings SET shelfRelativeAddress = shelfRelativeAddress + " + 
                                          nFacings + " " + whereClause;

   
    
    console.error("facing=",facing);
    console.error("nFacings=",nFacings);
    ////////////////////
    //this should be done cleaner with promises
    /* Begin transaction */
    client.beginTransaction(function(err) {
        if (err) { throw err; res.send("[error]");}
        
        client.query(updateFacingPositionsStatement, function(err, result) {
          if (err) { 
            client.rollback(function() {
              res.send("[error]");
              throw err;
            });
          }
          //var insertFacingStatement = 'INSERT INTO facings SET ?'
          var insertFacingStatement = 'INSERT INTO `facings`(' + getFieldList(facing) + ') VALUES';
          insertFacingStatement += ( getFacingValueLists(facing,nFacings) + ';' );
          console.log("**********************************************************");
          console.log("INSERT FACING STATEMENT = ",insertFacingStatement);
          client.query(insertFacingStatement, function(err, result) {
            if (err) { 
              client.rollback(function() {
                res.send("[error]");
                throw err;
              });
            }  
            client.commit(function(err) {
              if (err) { 
                client.rollback(function() {
                  res.send("[error]");
                  throw err;
                });
              }
              console.log('Transaction Complete.');
              res.send(result);
              
            });
          });
        });

    });
    /* End transaction */
    ///////////////////

    
   },
   getInventoryOverTime:function(client,req,res,mssh){
     
     //http://localhost:8080/dbGetInventoryOverTime?startdate=2020-02-23T14:30:00&enddate=2020-02-23T22:30:00&inthrs=1&intmins=15&returnintervalsonly=false&searchterms={%22storeID%22:[1,2],%22clientID%22:[1,2]}

     console.log("Getting InventoryOverTime");

     var returnintervalsonly = req.param("returnintervalsonly");
     if (returnintervalsonly == null){
      returnintervalsonly = "false";
     }
     var whereClause   = " where ";
     var orderbyClause = " order by "
     var searchterms   = req.param("searchterms");
     if (searchterms){
      searchterms = JSON.parse(searchterms);
     } else {
      searchterms = {};
     }
     var startdate     = req.param("startdate");
     var enddate       = req.param("enddate");
     var inthrs        = req.param("inthrs");
     var intmins       = req.param("intmins");
     
    
      /////////////////////////////////////////////////
     const formatDate = function(date) {
         var d = new Date(date);
         var month = '' + (d.getMonth() + 1);
         var day   = '' + d.getDate();
         var year  = d.getFullYear();
         var hour  = d.getHours();
         var min   = d.getMinutes();

        if (month.length < 2){ 
            month = '0' + month;
        }    
        if (day.length < 2){ 
            day = '0' + day;
        } 

        if (min.toString().length < 2){ 
            min = '0' + min;  
        }  

        if (hour.toString().length < 2){ 
            hour = '0' + hour;
        }    

        return ([year, month, day].join('-')) + "T" + hour + ":" + min + ":00" ;
     }    

     //////////////////////// addToDate function ////////////
     const addToDate = function(p_date,inthrs,intmins){
        
        var mDate = new Date(p_date);
        console.log("p_date=",p_date);
        console.log("mDate=",mDate);
        var seconds = mDate.getTime() / 1000; //1440516958
        //console.log("seconds=",seconds);
        console.log("inthrs=",inthrs);
        //console.log("seconds1=",seconds);
        console.log("intmins=",intmins);
        
        seconds += ((inthrs * 3600) + (intmins * 60));
        //console.log("seconds2=",seconds);

        var d = new Date(seconds*1000);
        console.log("formatDate(d)=",formatDate(d));
        return formatDate(d);

     }
     /////////////////////////////////////////////////////////



     //////////////////////// get_intervals function //////////////////////////////
     const get_intervals = function(startdate,enddate,inthrs,intmins) {
        r_val = [];
        var curr_date = startdate;
        // compare curr_date to enddate, if greater, exit loop
        var loopcount=0;
        while (enddate.localeCompare(curr_date) > 0){
          console.log("curr_date before add = ", curr_date)

          r_val.push(curr_date);
          curr_date = addToDate(curr_date,inthrs,intmins);
          console.log("curr_date after add =", curr_date, " inthrs = ",inthrs, " intmins = ",intmins);
          
        }
        return r_val;
     };
     ///////////////////////////////////////////// generate_sql function /////////////////
     const generate_sql = function(intervals){
        sql = "";
        for (t of intervals){
          ///////

            sql += "select * FROM (select max(`facingID`) as maxfacingID,"
                    + "max(`timeStamp`) as maxtimeStamp,";
            sql += ("'" + t + "' as asofdate "
                    + " from `sensorchanges` "
                    + "WHERE `sensorchanges`.`timeStamp`<='"
                    + t + "'"
                    + " group by `sensorchanges`.`facingID`) AS t1 "
                    + "LEFT JOIN sensorchanges "
                    + " ON t1.maxfacingID=sensorchanges.facingID AND t1.maxtimeStamp=sensorchanges.timeStamp");
            sql += " UNION ";
          ///////
        }
        sql = sql.substring(0, sql.length - 7);
        var where_clause = " ";
        //build the whereclause here]

        var orderby_clause = "ORDER BY sensorchangesMatrix.clientName," + 
                                      "sensorchangesMatrix.clientID," + 
                                      "sensorchangesMatrix.displayfixtureIDForUser," + 
                                      "sensorchangesMatrix.displayfixtureID," +
                                      "sensorchangesMatrix.shelfLevel desc," +
                                      "sensorchangesMatrix.shelfID," +
                                      "sensorchangesMatrix.facingShelfRelativeAddress," +
                                      "sensorchangesMatrix.facingID," +
                                      "asofdate desc" + 
                                      " "


        return "select * from ("
                + sql
                + ") AS a " 
                + " LEFT JOIN sensorchangesMatrix " 
                + " ON a.sensorChangeID=sensorchangesMatrix.sensorChangeID "
                + where_clause 
                + orderby_clause;
     };

     /*
     order by clientID,storeID,displayfixtureIDForUser, shelfLevel, facingShelfRelativeAddress;
     */
     //////////////////////////////////////////////////////////////////////////////

      console.log("startdate=",startdate,"enddate=",enddate,"inthrs=",inthrs,"intmins",intmins)
      //console.log("get_intervals = ",get_intervals(startdate,enddate,inthrs,intmins))
      var intervals = get_intervals(startdate,enddate,inthrs,intmins);
      

      // 
      // Return  intervals only, in a comma delimited string, return
      // if returnintervalsonly flag set in API call
      //
      if (returnintervalsonly.toUpperCase().localeCompare("TRUE") == 0){
        var r_line = "";
        //var loopits = 0
        for (interval of intervals){
            r_line = interval + "," + r_line;
            //loopits++;
        }
        r_line = r_line.substring(0,r_line.length - 1);
        //console.error("what's being sent for intervals = ",r_line,"loopits=",loopits);
        res.send(r_line);
        return;
      }

      var n = 0;
      for(i of intervals){
        console.log("interval[",n++,"] = ",i)
      }
      console.log("intervals generated...")
      var q = generate_sql(intervals);
      console.log("sql generated from intervals...");
      try{
          executeQuery(q,client,res,mssh);
      }catch(e){
        console.log("Error running sql = ",q, " in getRecordsByView");
      } 


   },
   getSensorDataOverTimeNOTUSED:function(client,req,res,mssh){

     // CURRENTLY NOT USED 6/29/20

     //http://localhost:8080/dbGetSensorOverTimeData?
     //                          startdate=2020-02-23-14:15
     //                          &enddate=2020-02-36-12:15
     //                          &searchterms={%22storeID%22:[1,2],%22clientID%22:[1,2]}
     

       
     console.log("Getting SensorDataOverTime");
     var whereClause   = " where ";
     var orderbyClause = " order by "
     var searchterms   = JSON.parse(req.param("searchterms"));
     var startdate     = req.param("startdate");
     var enddate       = req.param("enddate");
     var didloop=false;
     

     

     for (term in searchterms) {
            didloop=true;
            whereClause += (  term + " in " + "("  );
            console.log(term, "---",searchterms[term]);
            // now put all the items on the list
            for (const val of searchterms[term]){
                whereClause += val + ","
            }
            whereClause = whereClause.substr(0,whereClause.length-1);
            whereClause +=") AND "
     }

     if (!didloop){
       return;
     } 

     whereClause = whereClause.substr(0,whereClause.length-4);

     console.log("whereclause=",whereClause);
     // now put in the start and end dates;
     
     whereClause += " AND timeStamp>='"  + startdate + "'" + " AND timeStamp<='" + enddate + "'"

     orderbyClause += " clientName,clientID,storeName,storeID,displayfixtureIDForUser,displayfixtureID,shelfLevel,shelfID,facingShelfRelativeAddress,facingID,timestamp desc ";

     var q = "SELECT * FROM sensorchangesMatrix " + whereClause + orderbyClause + ";"
     console.log("executing query ==>", q)

      try{
        /* var v = executeQuery(q,client,res,mssh,true).then(value => {
                                  console.log("res=",value);
                          });*/

       executeQuery(q,client,res,mssh,groupSensorChangesByIntervals); 
       //var x = getPromise().then(value => {console.log("*****qres=",value)});              

      }catch(e){
        console.log("error=", e, " -----Error running PROMISE sql = ",q, " in getSensorDataOverTime");
      } 
   }
};

function groupSensorChangesByIntervals(res,qres){
   //console.log("the message =",message);
   res.send(qres);
}


function getPromise(){

      var x = 2;
      if (x == 1){

      }else{
        return new Promise(function(resolve, reject) {
                                                   resolve("qres");
                                                 
                    });

      }
      

}

var query_executions = 0;
var properties_reader = require('properties-reader');
var conn_properties = properties_reader('conn_creds.ini');

//helper functions
function getFieldList(mJSONObj){
  // creates a field list for an sql statement based on the fields of a JSONObject
  var field_list = "";
  for (var p in mJSONObj) {
      field_list+=("`" + p + "`," );
  }
  return field_list.substring(0,field_list.length-1);
}


function createSSHCredentials(conn_props){
    var ssh = new Object()
    ssh.host = conn_props.get("ssh.host");                                  
    ssh.user = conn_props.get("ssh.user");                                  
    ssh.password = conn_props.get("ssh.password");                                                          //'Dan123!';
    return ssh;
  }

  function createMySQLCredentials(conn_props){
    var server_mode = conn_properties.get("general.server_mode");

    var msc = new Object();
    msc.host = conn_props.get("sql_" + server_mode + ".host");                                                               //'127.0.0.1';
    msc.port = conn_props.get("sql_" + server_mode + ".port");
    msc.user = conn_props.get("sql_" + server_mode + ".user");
    msc.password = conn_props.get("sql_" + server_mode + ".password");
    msc.database = conn_props.get("sql_" + server_mode + ".database");
    return msc
  }

function getFacingValueLists(mJSONObj,nrecs){
    // for now just generate 1 value list
  var facingObj = mJSONObj;  
  var startingFacingAddress = parseInt(facingObj["shelfRelativeAddress"]);
  nrecs=parseInt(nrecs);
  var value_list = "";
  

  var limit = startingFacingAddress + nrecs;
  for (var i = startingFacingAddress; i < limit; i++){
      facingObj["shelfRelativeAddress"] = i;
      value_list += "("
      for (var p in facingObj) {
          var outChars = facingObj[p]+"";
          if (isNaN(facingObj[p])){
            outChars = "'" + outChars + "'";
          }
          value_list+=( outChars + "," );
      } 
      value_list = value_list.substring(0,value_list.length-1) + "),"; 
  }  
  
  return value_list.substring(0,value_list.length-1);

}

////////////FOR GETS /////////////////////////////
function executeQuery(sqlStatement,client,res, mssh,postProcessFunc){
  console.log("Executing Query...")
  try{

      // modified for transactions
          if (sqlStatement.charAt(sqlStatement.length-1)!=';'){
            sqlStatement += ";"
          }
          
          statementStack = (sqlStatement + "xx").split(";");
          
          for (var i = 0; i < statementStack.length-1;i++){

            client.query(sqlStatement, (qerr, qres) => {
                  query_executions++;
                  if (qerr ) { 
                      console.log("!!!!! error occuring in executeQuery()")
                      /////////
                      mssh  =  require('mysql-ssh');
                      console.log("SSH Authentication");

                      mssh.connect(createSSHCredentials(conn_properties),
                                   createMySQLCredentials(conn_properties)).
                                    then(client => {
                                 ///////////// this has no purpose except to create chatter on the console and restart the api engine
                                                     client.query('SELECT * FROM `stores`', function (err, results, fields) {
                                                                 if (err) throw err
                                                                   console.log("ERROR THROWN...RECONNECTING");
                                                                  })
                                                              connected_client = client;
                                                    }
                                         );
                      ////////
                      console.log(qerr); 
                     
                      console.log("Error, returning empty set");
                      res.send("[]");
                    
                       //throw qerr; 
                  }
                  else {
                      if (postProcessFunc){
                        console.log("returning results - initiating post processing");
                        postProcessFunc(res,qres)
                        
                      }else{
                        res.send(qres);
                        console.log("returning results - no post processing function");
                        console.log('query=',sqlStatement," SUCCESSFUL");
                      }
                      
                  }
                        
            });

          }
      }catch(e){
          console.error("Error = ",e);
          console.error("There was an error when executing " + sqlStatement);
          console.error("Connection could have been closed");
      } 
      //////////
      return new Promise(function(resolve, reject) {
                                        resolve("qres");
                                                     
                                 });

                        ////////// 

    }
