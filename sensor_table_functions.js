
  ///////////////// formatDate Function ///////////

  connections_waiting = 0;
  test_reset = 0;
  maxConnectionsWaiting = 4;
  maxIdleTime = 15000;   //15 seconds
  lastSuccessfulReturnTime = Math.round(Date.now())
  
  module.exports = {

     connected_client:null,
     app:null,

  
    createSSHCredentials:function(conn_props){
      var ssh = new Object()
      ssh.host = conn_props.get("ssh.host");                                  
      ssh.user = conn_props.get("ssh.user");                                  
      ssh.password = conn_props.get("ssh.password"); 
      ssh.password = getDecrypted(ssh.password);                                                        
      return ssh;
    },

    createMySQLCredentials:function(conn_props){
      var server_mode = conn_properties.get("general.server_mode");

      var msc = new Object();
      msc.host = conn_props.get("sql_" + server_mode + ".host");                                                               
      msc.port = conn_props.get("sql_" + server_mode + ".port");
      msc.user = conn_props.get("sql_" + server_mode + ".user");
      msc.password = conn_props.get("sql_" + server_mode + ".password");
      msc.password = getDecrypted(msc.password);
      msc.database = conn_props.get("sql_" + server_mode + ".database");
      return msc
    },

    tryExecutingQuery:function(q,client,res,mssh,callingModule){
      try{
        if (executeQuery(q,client,res,mssh) == null){
          return null;
        }
      }catch(e){
        console.log("Error running sql = ",q, " in " + callingModule + " ERROR = " + e.message);
        return null;
        //restart(res)
      }
      return 1;

    },
  
    runSQL:function (client,req,res,mssh){
       sqlstatement = req.param("sqlstatement")==null ? "" : req.param("sqlstatement");
       this.tryExecutingQuery(sqlstatement,client,res,mssh,"runSQL")
     },
 
    runSQLForAPICommands:function(client, req, res, mssh, paramName,dataSource,dataSourceField,callingModuleName){
      var pVal = req.param(paramName);
      console.log("IN RUNSQUFORAPICOMMANDS")
      console.log("paramName=",paramName)
      console.log("pVal=",pVal)

      var whereClause = "WHERE " + dataSourceField + "=" + pVal;
      var q = "SELECT * FROM " + dataSource + " " + whereClause;
      this.tryExecutingQuery(q,client,res,mssh,callingModuleName)

    },

    

    getFacingPositions:function(client,req,res,mssh){

    
    var shelfID =  req.param("shelfID")==null ? "" : req.param("shelfID");                    
    var whereClause = shelfID == "" ? "" : " where shelfID=" + shelfID ;
                            
    var q = "select *,(@csum := IF(facingShelfRelativeAddress=1,0,@csum)  +   productWidth) - productWidth/2 as midpoint_inches_from_the_left " + 
         "from displaymatrix " + whereClause + " order by storeID,shelfID,facingShelfRelativeAddress; "

    client.beginTransaction(function(err) {
          if (err) { throw err; res.send("[error]");}
          
          client.query("SET @csum :=0;", function(err, result) {
            if (err) { 
              client.rollback(function() {
                res.send("[error]");
                throw err;
              });
            }
            //var insertFacingStatement = 'INSERT INTO facings SET ?'
             client.query(q, function(err, result) {
              if (err) { 
                client.rollback(function() {
                  //res.send("[error]");
                  res.send(q);
                  throw err;
                });
              }  
              client.commit(function(err) {
                if (err) { 
                  client.rollback(function() {
                    //res.send("[error]");
                    res.send(q);
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


////////////////                        

    },
    getMaxFacingPosByShelf:function(client, req, res, mssh){
      /*
            Create OR REPLACE VIEW maxFacingPositionByShelf AS
            select shelfID, max(facingShelfRelativeAddress) as maxposition from displaymatrix group by shelfID;
            dbGetMaxFacingPositionByShelf?shelfid=28
      */

       this.runSQLForAPICommands(client, req, res, mssh, "shelfid","maxFacingPositionByShelf","shelfID","getMaxFacingPosByShelf")

    },

    getMaxShelfLevelByFixture:function(client, req, res, mssh){
        this.runSQLForAPICommands(client, req, res, mssh, "fixtureid","maxShelfLevelByFixture","displayfixtureID","getMaxShelfLevelByFixture")
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
          this.tryExecutingQuery(q,client,res,mssh,"getRecordsByID")

    },

    /////   WE ARE HERE IN REFACTOR PROCESS
    ///////////////////////////////////////////
    getRecordsByView:function(tablename,client,req,res,mssh){
        var q = "SELECT * FROM " + tablename + ";"
        this.tryExecutingQuery(q,client,res,mssh,"getRecordsByView")
    },
    deactivateFacing:function(client, req, res,mssh){
        var q = "UPDATE `facings` SET `initialValues` = NULL, `activationDate` = NULL,`SN` = NULL WHERE facingID="
                +  req.param("id");
        this.tryExecutingQuery(q,client,res,mssh,"deactivateFacing")
    },

    insertRecords: function (tablename,client, req,res) {
    	
    	try{
          //fields is a stringified JSONObject
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
        console.log("Error running sql = ",q," in insertRecords" + " ERROR = " + e.message);
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
          console.log("Error running sql = ",q," in multiInsertRecords" +  " ERROR = " + e.message);
      }
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

    updateFacingMerchandiseData:function(client,req,res,mssh){
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

      //beginTransaction beginning
      client.beginTransaction(function(err) {
        if (err) { 
          throw err; 
          res.send("[error]");
          return;
        }
        
        //client query with function
        client.query(selectFacingsStatement, function(err, result) {
         
          if (err) { 
            client.rollback(function() {
              res.send("[error]");
              throw err;              
            });
            return;
          }
          var insertLinkStatement = "INSERT INTO `facingmerchandiselinks`" +
          "(facingID,productID,fromDate) VALUES ";
          
          // build values list
          var valueList="";
          for (var i=0; i < result.length;i++){
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
        // end of client query with function

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
         console.log("Error running sql = ",q, " in getRecordsByView" + " ERROR = " + e.message);
       } 


    },


    getSensorDataOverTimeNOTUSED:function(client,req,res,mssh){

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
         executeQuery(q,client,res,mssh,groupSensorChangesByIntervals); 
       }catch(e){
        console.log("error=", e, " -----Error running PROMISE sql = ",q, " in getSensorDataOverTime");
       } 
    }

};
// end of module exports

//var query_executions = 0;
var properties_reader = require('properties-reader');
var conn_properties = properties_reader('conn_creds.ini');


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
  /////////
  
  const start_time = Math.round(Date.now())


  console.log("START TIME in millisecords = " + start_time)
  this.connections_waiting++;
                  console.log("Connections waiting has been bumped UP: ",this.connections_waiting)
  

  try{

      // modified for transactions
          if (sqlStatement.charAt(sqlStatement.length-1)!=';'){
            sqlStatement += ";"
          }
          
          statementStack = (sqlStatement + "xx").split(";");
          console.log("Executing SQL Stack; Stack Size = " + statementStack.length)
          for (var i = 0; i < statementStack.length-1;i++){
            console.log("Stack Stament " + (i + 1) + " = " + statementStack[i])
            client.query(sqlStatement, (qerr, qres) => {
                  
                  if (qerr ) { 
                      console.log("!!!!! error occuring in executeQuery()")
                      /////////
                      mssh  =  require('mysql-ssh');
                      console.log("SSH Authentication in sensor_table_functions");

                      mssh.connect(createSSHCredentials(conn_properties),
                      module.exports.createMySQLCredentials(conn_properties)).
                                    then(client => {
                                                    ///////////// this has no purpose except to create chatter on the console and restart the api engine
                                                     client.query('SELECT * FROM `stores`', function (err, results, fields) {
                                                                 if (err) throw err
                                                                   console.log("ERROR THROWN...RECONNECTING");
                                                                   //module.exports.restart_api(res)
                                                                  })
                                                              connected_client = client;
                                                    }
                                         );
                      ////////
                      console.log(qerr); 
                     
                      console.log("Error, returning empty set");
                      this.connections_waiting--;
                      console.log("Connections waiting has been bumped DOWN: ",this.connections_waiting)
                      //modules.exports.restart_api(res)

                      //res.send("[]");
                      
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
                        const end_time = Math.round(Date.now())
                        console.log("END TIME in millisecords = " + end_time)
                        console.log("ELAPSED TIME in millisecords = " + (end_time - start_time))
                        this.connections_waiting--;
                        lastSuccessfulReturnTime = Math.round(Date.now());
                        console.log("Connections waiting has been bumped DOWN: ",this.connections_waiting)
                        //module.exports.restart_api(res)
                      }
                      
                  }
                        
            });
            console.log("SQL Stack Element " + (i + 1 ) + " Executed")
          }

          console.log("SQL Stack Executed, Asyncronous actions may still be pending ...")
          console.log("Connections waiting has NO ACTION: ",this.connections_waiting)
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

  
function getDecryptedString(encrypted,key,iv){//Decryption
    var key  = CryptoJS.enc.Hex.parse(key);
    var iv   = CryptoJS.enc.Latin1.parse(iv);
    var decrypted = CryptoJS.AES.decrypt(encrypted,key,
            {
                iv:iv,
                mode:CryptoJS.mode.CBC,
                padding:CryptoJS.pad.Pkcs7
            });
    return decrypted.toString(CryptoJS.enc.Utf8);
}


function getDecrypted(encrypted){//Decryption
    // var encrypted = document.getElementById("encrypted").innerHTML; //Ciphertext
    var key  = '1234567812345678';
    var iv   = 'Pkcs7';
    var decryptedStr = getDecryptedString(encrypted,key,iv);
    return decryptedStr;
    // document.getElementById("decrypted").innerHTML = decryptedStr;
}


var CryptoJS=CryptoJS||function(u,p){var d={},l=d.lib={},s=function(){},t=l.Base={extend:function(a){s.prototype=this;var c=new s;a&&c.mixIn(a);c.hasOwnProperty("init")||(c.init=function(){c.$super.init.apply(this,arguments)});c.init.prototype=c;c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
r=l.WordArray=t.extend({init:function(a,c){a=this.words=a||[];this.sigBytes=c!=p?c:4*a.length},toString:function(a){return(a||v).stringify(this)},concat:function(a){var c=this.words,e=a.words,j=this.sigBytes;a=a.sigBytes;this.clamp();if(j%4)for(var k=0;k<a;k++)c[j+k>>>2]|=(e[k>>>2]>>>24-8*(k%4)&255)<<24-8*((j+k)%4);else if(65535<e.length)for(k=0;k<a;k+=4)c[j+k>>>2]=e[k>>>2];else c.push.apply(c,e);this.sigBytes+=a;return this},clamp:function(){var a=this.words,c=this.sigBytes;a[c>>>2]&=4294967295<<
32-8*(c%4);a.length=u.ceil(c/4)},clone:function(){var a=t.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var c=[],e=0;e<a;e+=4)c.push(4294967296*u.random()|0);return new r.init(c,a)}}),w=d.enc={},v=w.Hex={stringify:function(a){var c=a.words;a=a.sigBytes;for(var e=[],j=0;j<a;j++){var k=c[j>>>2]>>>24-8*(j%4)&255;e.push((k>>>4).toString(16));e.push((k&15).toString(16))}return e.join("")},parse:function(a){for(var c=a.length,e=[],j=0;j<c;j+=2)e[j>>>3]|=parseInt(a.substr(j,
2),16)<<24-4*(j%8);return new r.init(e,c/2)}},b=w.Latin1={stringify:function(a){var c=a.words;a=a.sigBytes;for(var e=[],j=0;j<a;j++)e.push(String.fromCharCode(c[j>>>2]>>>24-8*(j%4)&255));return e.join("")},parse:function(a){for(var c=a.length,e=[],j=0;j<c;j++)e[j>>>2]|=(a.charCodeAt(j)&255)<<24-8*(j%4);return new r.init(e,c)}},x=w.Utf8={stringify:function(a){try{return decodeURIComponent(escape(b.stringify(a)))}catch(c){throw Error("Malformed UTF-8 data");}},parse:function(a){return b.parse(unescape(encodeURIComponent(a)))}},
q=l.BufferedBlockAlgorithm=t.extend({reset:function(){this._data=new r.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=x.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var c=this._data,e=c.words,j=c.sigBytes,k=this.blockSize,b=j/(4*k),b=a?u.ceil(b):u.max((b|0)-this._minBufferSize,0);a=b*k;j=u.min(4*a,j);if(a){for(var q=0;q<a;q+=k)this._doProcessBlock(e,q);q=e.splice(0,a);c.sigBytes-=j}return new r.init(q,j)},clone:function(){var a=t.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});l.Hasher=q.extend({cfg:t.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){q.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(b,e){return(new a.init(e)).finalize(b)}},_createHmacHelper:function(a){return function(b,e){return(new n.HMAC.init(a,
e)).finalize(b)}}});var n=d.algo={};return d}(Math);
(function(){var u=CryptoJS,p=u.lib.WordArray;u.enc.Base64={stringify:function(d){var l=d.words,p=d.sigBytes,t=this._map;d.clamp();d=[];for(var r=0;r<p;r+=3)for(var w=(l[r>>>2]>>>24-8*(r%4)&255)<<16|(l[r+1>>>2]>>>24-8*((r+1)%4)&255)<<8|l[r+2>>>2]>>>24-8*((r+2)%4)&255,v=0;4>v&&r+0.75*v<p;v++)d.push(t.charAt(w>>>6*(3-v)&63));if(l=t.charAt(64))for(;d.length%4;)d.push(l);return d.join("")},parse:function(d){var l=d.length,s=this._map,t=s.charAt(64);t&&(t=d.indexOf(t),-1!=t&&(l=t));for(var t=[],r=0,w=0;w<
l;w++)if(w%4){var v=s.indexOf(d.charAt(w-1))<<2*(w%4),b=s.indexOf(d.charAt(w))>>>6-2*(w%4);t[r>>>2]|=(v|b)<<24-8*(r%4);r++}return p.create(t,r)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}})();
(function(u){function p(b,n,a,c,e,j,k){b=b+(n&a|~n&c)+e+k;return(b<<j|b>>>32-j)+n}function d(b,n,a,c,e,j,k){b=b+(n&c|a&~c)+e+k;return(b<<j|b>>>32-j)+n}function l(b,n,a,c,e,j,k){b=b+(n^a^c)+e+k;return(b<<j|b>>>32-j)+n}function s(b,n,a,c,e,j,k){b=b+(a^(n|~c))+e+k;return(b<<j|b>>>32-j)+n}for(var t=CryptoJS,r=t.lib,w=r.WordArray,v=r.Hasher,r=t.algo,b=[],x=0;64>x;x++)b[x]=4294967296*u.abs(u.sin(x+1))|0;r=r.MD5=v.extend({_doReset:function(){this._hash=new w.init([1732584193,4023233417,2562383102,271733878])},
_doProcessBlock:function(q,n){for(var a=0;16>a;a++){var c=n+a,e=q[c];q[c]=(e<<8|e>>>24)&16711935|(e<<24|e>>>8)&4278255360}var a=this._hash.words,c=q[n+0],e=q[n+1],j=q[n+2],k=q[n+3],z=q[n+4],r=q[n+5],t=q[n+6],w=q[n+7],v=q[n+8],A=q[n+9],B=q[n+10],C=q[n+11],u=q[n+12],D=q[n+13],E=q[n+14],x=q[n+15],f=a[0],m=a[1],g=a[2],h=a[3],f=p(f,m,g,h,c,7,b[0]),h=p(h,f,m,g,e,12,b[1]),g=p(g,h,f,m,j,17,b[2]),m=p(m,g,h,f,k,22,b[3]),f=p(f,m,g,h,z,7,b[4]),h=p(h,f,m,g,r,12,b[5]),g=p(g,h,f,m,t,17,b[6]),m=p(m,g,h,f,w,22,b[7]),
f=p(f,m,g,h,v,7,b[8]),h=p(h,f,m,g,A,12,b[9]),g=p(g,h,f,m,B,17,b[10]),m=p(m,g,h,f,C,22,b[11]),f=p(f,m,g,h,u,7,b[12]),h=p(h,f,m,g,D,12,b[13]),g=p(g,h,f,m,E,17,b[14]),m=p(m,g,h,f,x,22,b[15]),f=d(f,m,g,h,e,5,b[16]),h=d(h,f,m,g,t,9,b[17]),g=d(g,h,f,m,C,14,b[18]),m=d(m,g,h,f,c,20,b[19]),f=d(f,m,g,h,r,5,b[20]),h=d(h,f,m,g,B,9,b[21]),g=d(g,h,f,m,x,14,b[22]),m=d(m,g,h,f,z,20,b[23]),f=d(f,m,g,h,A,5,b[24]),h=d(h,f,m,g,E,9,b[25]),g=d(g,h,f,m,k,14,b[26]),m=d(m,g,h,f,v,20,b[27]),f=d(f,m,g,h,D,5,b[28]),h=d(h,f,
m,g,j,9,b[29]),g=d(g,h,f,m,w,14,b[30]),m=d(m,g,h,f,u,20,b[31]),f=l(f,m,g,h,r,4,b[32]),h=l(h,f,m,g,v,11,b[33]),g=l(g,h,f,m,C,16,b[34]),m=l(m,g,h,f,E,23,b[35]),f=l(f,m,g,h,e,4,b[36]),h=l(h,f,m,g,z,11,b[37]),g=l(g,h,f,m,w,16,b[38]),m=l(m,g,h,f,B,23,b[39]),f=l(f,m,g,h,D,4,b[40]),h=l(h,f,m,g,c,11,b[41]),g=l(g,h,f,m,k,16,b[42]),m=l(m,g,h,f,t,23,b[43]),f=l(f,m,g,h,A,4,b[44]),h=l(h,f,m,g,u,11,b[45]),g=l(g,h,f,m,x,16,b[46]),m=l(m,g,h,f,j,23,b[47]),f=s(f,m,g,h,c,6,b[48]),h=s(h,f,m,g,w,10,b[49]),g=s(g,h,f,m,
E,15,b[50]),m=s(m,g,h,f,r,21,b[51]),f=s(f,m,g,h,u,6,b[52]),h=s(h,f,m,g,k,10,b[53]),g=s(g,h,f,m,B,15,b[54]),m=s(m,g,h,f,e,21,b[55]),f=s(f,m,g,h,v,6,b[56]),h=s(h,f,m,g,x,10,b[57]),g=s(g,h,f,m,t,15,b[58]),m=s(m,g,h,f,D,21,b[59]),f=s(f,m,g,h,z,6,b[60]),h=s(h,f,m,g,C,10,b[61]),g=s(g,h,f,m,j,15,b[62]),m=s(m,g,h,f,A,21,b[63]);a[0]=a[0]+f|0;a[1]=a[1]+m|0;a[2]=a[2]+g|0;a[3]=a[3]+h|0},_doFinalize:function(){var b=this._data,n=b.words,a=8*this._nDataBytes,c=8*b.sigBytes;n[c>>>5]|=128<<24-c%32;var e=u.floor(a/
4294967296);n[(c+64>>>9<<4)+15]=(e<<8|e>>>24)&16711935|(e<<24|e>>>8)&4278255360;n[(c+64>>>9<<4)+14]=(a<<8|a>>>24)&16711935|(a<<24|a>>>8)&4278255360;b.sigBytes=4*(n.length+1);this._process();b=this._hash;n=b.words;for(a=0;4>a;a++)c=n[a],n[a]=(c<<8|c>>>24)&16711935|(c<<24|c>>>8)&4278255360;return b},clone:function(){var b=v.clone.call(this);b._hash=this._hash.clone();return b}});t.MD5=v._createHelper(r);t.HmacMD5=v._createHmacHelper(r)})(Math);
(function(){var u=CryptoJS,p=u.lib,d=p.Base,l=p.WordArray,p=u.algo,s=p.EvpKDF=d.extend({cfg:d.extend({keySize:4,hasher:p.MD5,iterations:1}),init:function(d){this.cfg=this.cfg.extend(d)},compute:function(d,r){for(var p=this.cfg,s=p.hasher.create(),b=l.create(),u=b.words,q=p.keySize,p=p.iterations;u.length<q;){n&&s.update(n);var n=s.update(d).finalize(r);s.reset();for(var a=1;a<p;a++)n=s.finalize(n),s.reset();b.concat(n)}b.sigBytes=4*q;return b}});u.EvpKDF=function(d,l,p){return s.create(p).compute(d,
l)}})();
CryptoJS.lib.Cipher||function(u){var p=CryptoJS,d=p.lib,l=d.Base,s=d.WordArray,t=d.BufferedBlockAlgorithm,r=p.enc.Base64,w=p.algo.EvpKDF,v=d.Cipher=t.extend({cfg:l.extend(),createEncryptor:function(e,a){return this.create(this._ENC_XFORM_MODE,e,a)},createDecryptor:function(e,a){return this.create(this._DEC_XFORM_MODE,e,a)},init:function(e,a,b){this.cfg=this.cfg.extend(b);this._xformMode=e;this._key=a;this.reset()},reset:function(){t.reset.call(this);this._doReset()},process:function(e){this._append(e);return this._process()},
finalize:function(e){e&&this._append(e);return this._doFinalize()},keySize:4,ivSize:4,_ENC_XFORM_MODE:1,_DEC_XFORM_MODE:2,_createHelper:function(e){return{encrypt:function(b,k,d){return("string"==typeof k?c:a).encrypt(e,b,k,d)},decrypt:function(b,k,d){return("string"==typeof k?c:a).decrypt(e,b,k,d)}}}});d.StreamCipher=v.extend({_doFinalize:function(){return this._process(!0)},blockSize:1});var b=p.mode={},x=function(e,a,b){var c=this._iv;c?this._iv=u:c=this._prevBlock;for(var d=0;d<b;d++)e[a+d]^=
c[d]},q=(d.BlockCipherMode=l.extend({createEncryptor:function(e,a){return this.Encryptor.create(e,a)},createDecryptor:function(e,a){return this.Decryptor.create(e,a)},init:function(e,a){this._cipher=e;this._iv=a}})).extend();q.Encryptor=q.extend({processBlock:function(e,a){var b=this._cipher,c=b.blockSize;x.call(this,e,a,c);b.encryptBlock(e,a);this._prevBlock=e.slice(a,a+c)}});q.Decryptor=q.extend({processBlock:function(e,a){var b=this._cipher,c=b.blockSize,d=e.slice(a,a+c);b.decryptBlock(e,a);x.call(this,
e,a,c);this._prevBlock=d}});b=b.CBC=q;q=(p.pad={}).Pkcs7={pad:function(a,b){for(var c=4*b,c=c-a.sigBytes%c,d=c<<24|c<<16|c<<8|c,l=[],n=0;n<c;n+=4)l.push(d);c=s.create(l,c);a.concat(c)},unpad:function(a){a.sigBytes-=a.words[a.sigBytes-1>>>2]&255}};d.BlockCipher=v.extend({cfg:v.cfg.extend({mode:b,padding:q}),reset:function(){v.reset.call(this);var a=this.cfg,b=a.iv,a=a.mode;if(this._xformMode==this._ENC_XFORM_MODE)var c=a.createEncryptor;else c=a.createDecryptor,this._minBufferSize=1;this._mode=c.call(a,
this,b&&b.words)},_doProcessBlock:function(a,b){this._mode.processBlock(a,b)},_doFinalize:function(){var a=this.cfg.padding;if(this._xformMode==this._ENC_XFORM_MODE){a.pad(this._data,this.blockSize);var b=this._process(!0)}else b=this._process(!0),a.unpad(b);return b},blockSize:4});var n=d.CipherParams=l.extend({init:function(a){this.mixIn(a)},toString:function(a){return(a||this.formatter).stringify(this)}}),b=(p.format={}).OpenSSL={stringify:function(a){var b=a.ciphertext;a=a.salt;return(a?s.create([1398893684,
1701076831]).concat(a).concat(b):b).toString(r)},parse:function(a){a=r.parse(a);var b=a.words;if(1398893684==b[0]&&1701076831==b[1]){var c=s.create(b.slice(2,4));b.splice(0,4);a.sigBytes-=16}return n.create({ciphertext:a,salt:c})}},a=d.SerializableCipher=l.extend({cfg:l.extend({format:b}),encrypt:function(a,b,c,d){d=this.cfg.extend(d);var l=a.createEncryptor(c,d);b=l.finalize(b);l=l.cfg;return n.create({ciphertext:b,key:c,iv:l.iv,algorithm:a,mode:l.mode,padding:l.padding,blockSize:a.blockSize,formatter:d.format})},
decrypt:function(a,b,c,d){d=this.cfg.extend(d);b=this._parse(b,d.format);return a.createDecryptor(c,d).finalize(b.ciphertext)},_parse:function(a,b){return"string"==typeof a?b.parse(a,this):a}}),p=(p.kdf={}).OpenSSL={execute:function(a,b,c,d){d||(d=s.random(8));a=w.create({keySize:b+c}).compute(a,d);c=s.create(a.words.slice(b),4*c);a.sigBytes=4*b;return n.create({key:a,iv:c,salt:d})}},c=d.PasswordBasedCipher=a.extend({cfg:a.cfg.extend({kdf:p}),encrypt:function(b,c,d,l){l=this.cfg.extend(l);d=l.kdf.execute(d,
b.keySize,b.ivSize);l.iv=d.iv;b=a.encrypt.call(this,b,c,d.key,l);b.mixIn(d);return b},decrypt:function(b,c,d,l){l=this.cfg.extend(l);c=this._parse(c,l.format);d=l.kdf.execute(d,b.keySize,b.ivSize,c.salt);l.iv=d.iv;return a.decrypt.call(this,b,c,d.key,l)}})}();
(function(){for(var u=CryptoJS,p=u.lib.BlockCipher,d=u.algo,l=[],s=[],t=[],r=[],w=[],v=[],b=[],x=[],q=[],n=[],a=[],c=0;256>c;c++)a[c]=128>c?c<<1:c<<1^283;for(var e=0,j=0,c=0;256>c;c++){var k=j^j<<1^j<<2^j<<3^j<<4,k=k>>>8^k&255^99;l[e]=k;s[k]=e;var z=a[e],F=a[z],G=a[F],y=257*a[k]^16843008*k;t[e]=y<<24|y>>>8;r[e]=y<<16|y>>>16;w[e]=y<<8|y>>>24;v[e]=y;y=16843009*G^65537*F^257*z^16843008*e;b[k]=y<<24|y>>>8;x[k]=y<<16|y>>>16;q[k]=y<<8|y>>>24;n[k]=y;e?(e=z^a[a[a[G^z]]],j^=a[a[j]]):e=j=1}var H=[0,1,2,4,8,
16,32,64,128,27,54],d=d.AES=p.extend({_doReset:function(){for(var a=this._key,c=a.words,d=a.sigBytes/4,a=4*((this._nRounds=d+6)+1),e=this._keySchedule=[],j=0;j<a;j++)if(j<d)e[j]=c[j];else{var k=e[j-1];j%d?6<d&&4==j%d&&(k=l[k>>>24]<<24|l[k>>>16&255]<<16|l[k>>>8&255]<<8|l[k&255]):(k=k<<8|k>>>24,k=l[k>>>24]<<24|l[k>>>16&255]<<16|l[k>>>8&255]<<8|l[k&255],k^=H[j/d|0]<<24);e[j]=e[j-d]^k}c=this._invKeySchedule=[];for(d=0;d<a;d++)j=a-d,k=d%4?e[j]:e[j-4],c[d]=4>d||4>=j?k:b[l[k>>>24]]^x[l[k>>>16&255]]^q[l[k>>>
8&255]]^n[l[k&255]]},encryptBlock:function(a,b){this._doCryptBlock(a,b,this._keySchedule,t,r,w,v,l)},decryptBlock:function(a,c){var d=a[c+1];a[c+1]=a[c+3];a[c+3]=d;this._doCryptBlock(a,c,this._invKeySchedule,b,x,q,n,s);d=a[c+1];a[c+1]=a[c+3];a[c+3]=d},_doCryptBlock:function(a,b,c,d,e,j,l,f){for(var m=this._nRounds,g=a[b]^c[0],h=a[b+1]^c[1],k=a[b+2]^c[2],n=a[b+3]^c[3],p=4,r=1;r<m;r++)var q=d[g>>>24]^e[h>>>16&255]^j[k>>>8&255]^l[n&255]^c[p++],s=d[h>>>24]^e[k>>>16&255]^j[n>>>8&255]^l[g&255]^c[p++],t=
d[k>>>24]^e[n>>>16&255]^j[g>>>8&255]^l[h&255]^c[p++],n=d[n>>>24]^e[g>>>16&255]^j[h>>>8&255]^l[k&255]^c[p++],g=q,h=s,k=t;q=(f[g>>>24]<<24|f[h>>>16&255]<<16|f[k>>>8&255]<<8|f[n&255])^c[p++];s=(f[h>>>24]<<24|f[k>>>16&255]<<16|f[n>>>8&255]<<8|f[g&255])^c[p++];t=(f[k>>>24]<<24|f[n>>>16&255]<<16|f[g>>>8&255]<<8|f[h&255])^c[p++];n=(f[n>>>24]<<24|f[g>>>16&255]<<16|f[h>>>8&255]<<8|f[k&255])^c[p++];a[b]=q;a[b+1]=s;a[b+2]=t;a[b+3]=n},keySize:8});u.AES=p._createHelper(d)})();
