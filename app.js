//jshint esversion:6
const express=require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");
const app=express();
const mongoose=require("mongoose");
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const path=require("path");
const crypto=require("crypto");
const multer=require("multer");
const GridFsStorage=require("multer-gridfs-storage");
const Grid=require("gridfs-stream");
const methodOverride=require("method-override");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy=require("passport-facebook");
//variables
var errors=[],success=[];
var userMessage;
var membersOfNewTeam=[];

//middleware
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
 secret:"Our little secret.",
 resave:false,
 saveUninitialized:false
}));
app.use(methodOverride("_method"));
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser:true});
const conn=mongoose.connection;
let gfs;
//conn.on('error', console.error.bind(console, 'connection error:'));
conn.once("open",function(){
  gfs=Grid(conn.db,mongoose.mongo);
  gfs.collection("uploads");
});
const storage = new GridFsStorage({
  url: "mongodb://localhost:27017/userDB",
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });
mongoose.set("useCreateIndex",true);
mongoose.set('useFindAndModify', false);
const userSchema=new mongoose.Schema({
  name:String,
  username:String,
  password:String,
  joinRequests:Array,
  yourJoinRequests:Array,
  teams:Array,
  googleId:String,
  facebookId:String
});
const teamSchema=new mongoose.Schema({
  name:String,
  description:String,
  members:Array,
  discuss:Array,
  joinRequests:Array,
  yourJoinRequests:Array,
  filesArray:Array
});
userSchema.plugin(passportLocalMongoose);
const User=new mongoose.model("User",userSchema);
const Team=new mongoose.model("Team",teamSchema);
passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


passport.use(new GoogleStrategy({
    clientID:"961477758005-16bogm8mehvdetdpfd9aclhcdvemibns.apps.googleusercontent.com",
    clientSecret:"k7lJiqmtfa-A5dBMMAt84lhJ",
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOne({googleId:profile.id},function(err,doc){
      if(err)
      console.log(err);
      else{
          if(!doc){
            doc= new User({
              googleId:profile.id,
              name:profile.displayName,
              username:profile.emails[0].value,
              joinRequests:[],
              yourJoinRequests:[],
              teams:[],
              facebookId:""
            });
            doc.save(function(err) {
                    if (err) console.log(err);
                    return cb(err, doc);
                });
          }
          else {
                return cb(err, doc);
                }



      }
    });
  }
));
passport.use(new FacebookStrategy({
    clientID: "1418323321656649",
    clientSecret: "0ec5d568e84f86bb9bba72ebd83ad7c2",
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    //console.log(profile);
    User.findOne({facebookId:profile.id},function(err,doc){
      if(err)
      console.log(err);
      else{
          if(!doc){
            doc= new User({
              facebookId:profile.id,
              name:profile.displayName,
              username:profile.displayName.replace(/ /g,''),
              joinRequests:[],
              yourJoinRequests:[],
              teams:[],
              googleId:""
            });
            doc.save(function(err) {
                    if (err) console.log(err);
                    return cb(err, doc);
                });
          }
          else {
                return cb(err, doc);
                }



      }
    });

  }
));



//Home route
app.get("/",function(req,res){

  let err=[],suc=[];
  if(errors.length){
    err=errors;
    errors=[];
  }
  if(success.length){
    suc=success;
    success=[];
  }

  res.render("home",{errors:err,success:suc});
});
//Register route
app.post("/register",function(req,res){
  errors=[];success=[];
  if(req.body.username.length<5){
    errors.push("The username must be atleat 5 characters");
  }
if(req.body.username.includes(" ")){
  errors.push("Username must not include spaces");
}
if(req.body.password.length<5){
  errors.push("Password must atleat be 5 characters long");
}
if(req.body.confirmPassword!=req.body.password){
  errors.push("Password and Confirm Passwords have different values");
}
if(req.body.username.includes(" ")){
  errors.push("Username must not contain space");
}
User.findOne({username:req.body.username},function(err,doc){
  if(err)
  console.log(err);
  else{
    if(doc)
    errors.push("Username Already Taken");
    if(errors.length>0){
      //console.log("In if");
      res.redirect("/");
    }
    if(errors.length==0){
    //console.log("In else");
    success.push("Successfully registered!You can log in now");
      User.register({username:req.body.username,googleId:"",facebookId:"",joinRequests:[],yourJoinRequests:[],teams:[],name:req.body.name},req.body.password,function(err,user){
          if(err){
          console.log(err);
          }
          else{
            passport.authenticate("local")(req,res,function(){



            });
          }
        });
        res.redirect("/");
    }

  }
});


});
app.get('/auth/google', passport.authenticate('google', { scope: [ 'https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/userinfo.email'] }));
app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: "/" }),
  function(req, res) {
    res.redirect("/user/"+req.user.username);

  });

  app.get('/auth/facebook',
    passport.authenticate('facebook'));
    app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: "/" }),
  function(req, res) {
res.redirect("/user/"+req.user.username);

  });

//Login
app.post("/login",function(req,res){
  const user=new User({
    username:req.body.username,
    password:req.body.password
  });
  passport.authenticate("local")(req,res,function(){
    //res.send("Login successful");
    res.redirect("/user/"+user.username);
  });
});
//User Home
app.get("/leaveTeam/:user/:id",function(req,res){
  User.findOne({username:req.params.user},function(err,doc){
    if(err)
    console.log(err);
    else{
     Team.findById(req.params.id,function(err,docs){
       if(err)
       console.log(err);
       else{
         docs.members.forEach(function(e,i){
           if(e.username==req.params.user){
             docs.members.splice(i,1);
           }
         });
         docs.save(function(err){
           if(err)
           console.log(err);
         });
       }
     });
      doc.teams.forEach(function(e,i){
        if(e==req.params.id){
          doc.teams.splice(i,1);
        }
      });
      doc.save(function(err){
        if(err){
          console.log(err);
        }
      });
    }
  });


  res.redirect("/user/"+req.params.user);
});
app.get("/user/:user",function(req,res){
 if(req.isAuthenticated()){
   membersOfNewTeam=[];
   userMessage="Your Teams";
   User.findOne({username:req.params.user},function(err,doc){
     if(err)
     console.log(err);
     else{var t=[];
       let member={id:doc._id,username:req.params.user};
       membersOfNewTeam.push(member);
       function step(i){
         if(i<doc.teams.length){
           Team.findById(doc.teams[i],function(err,docs){
             if(err)
             console.log(err);
             else{
               k={name:docs.name,description:docs.description,id:docs._id};
               t.push(k);
               step(i+1);
             }
           });

         }else{

     res.render("userHome",{user:req.params.user,teams:t,m:userMessage,isTrue:true,isJs:false});
         }
       }
      step(0);


     }
   });
 }
 else{
   res.redirect("/");
 }

});
//Join Requests
app.get("/user/joinRequests/:user",function(req,res){
 if(req.isAuthenticated()){
   userMessage="Your Join Requests";
   User.findOne({username:req.params.user},function(err,doc){
     if(err)
     console.log(err);
     else{var t=[];
       function step(i){
         if(i<doc.joinRequests.length){
           Team.findById(doc.joinRequests[i],function(err,docs){
             if(err)
             console.log(err);
             else{
               k={name:docs.name,description:docs.description,id:docs._id};
               t.push(k);
               step(i+1);
             }
           });

         }else{
           //console.log(t);

     res.render("userHome",{user:req.params.user,teams:t,m:userMessage,isTrue:false,isJs:true});
         }
       }
      step(0);



     }
   });
 }
 else{
   res.redirect("/");
 }

});
//your Join requests
app.get("/user/yourJoinRequests/:user",function(req,res){
 if(req.isAuthenticated()){
   userMessage="Join Requests That you sent";
   User.findOne({username:req.params.user},function(err,doc){
     if(err)
     console.log(err);
     else{var t=[];
       function step(i){
         if(i<doc.yourJoinRequests.length){
           Team.findById(doc.yourJoinRequests[i],function(err,docs){
             if(err)
             console.log(err);
             else{
               k={name:docs.name,description:docs.description,id:docs._id};
               t.push(k);
               step(i+1);
             }
           });

         }else{
              Team.find({},"name _id description members",function(err,teams){
                   if(err)
                   console.log(err);
                   else{let flag=[];
                       let array=[];
                         teams.forEach(function(e,i){
                           flag=[];
                           doc.teams.forEach(function(ele){
                             //console.log(ele+" "+e._id);
                             if(e._id.equals(ele)){
                               //console.log("In here");
                               flag.push(false);

                             }
                           });

                           doc.joinRequests.forEach(function(ele1){
                             if(e._id.equals(ele1)){

                               flag.push(false);
                             }
                           });
                           doc.yourJoinRequests.forEach(function(ele2){
                             if(e._id.equals(ele2)){

                               flag.push(false);
                             }
                           });

                           if(flag.length==0){
                             array.push(e);
                           }
                         });
                        //console.log(array);
                       res.render("userHome",{user:req.params.user,teams:t,m:userMessage,isTrue:false,isJs:false,array:array});
                   }



              });

         }
       }
      step(0);



     }
   });
 }
 else{
   res.redirect("/");
 }

});
//logout

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});
//New team
var array=[];
app.get("/newTeam/:user",function(req,res){
  array=[];
  User.find({username:{$ne:req.params.user}},function(err,docs){
    if(err)
    console.log(err);
    else{let flag;
      for(var i=0;i<docs.length;i++){
        flag=true;
        for(var j=0;j<membersOfNewTeam.length;j++){
          if(docs[i].username==membersOfNewTeam[j].username)
          flag=false;
        }
        if(flag){
          array.push(docs[i].username);
        }
      }
      let err=[],suc=[];
      if(errors.length>0){
        err=errors;
        errors=[];
      }


      res.render("newTeam",{user:req.params.user,array:membersOfNewTeam,names:array,errors:err,success:suc});
    }
  });

  });

app.post("/addNewUser/:user/:member",function(req,res){
  User.findOne({username:req.params.member},function(err,doc){
    if(err)
    console.log(err);
    else{
      let member={id:doc._id,username:doc.username};
      membersOfNewTeam.push(member);
      res.redirect("/newTeam/"+req.params.user);
      }
  });
});
app.post("/newTeam/:user",function(req,res){
  errors=[];
  success=[];
  if(!req.body.name){
    errors.push("Please Enter a name for your Team!");

  }
  if(!req.body.description){
    errors.push("The form must have a description!");
  }
  if(errors.length>0){
    res.redirect("/newTeam/"+req.params.user);
  }else{//console.log(membersOfNewTeam);
    const team= new Team({
      name:req.body.name,
      description:req.body.description,
      members:[membersOfNewTeam.shift()],
      yourJoinRequests:membersOfNewTeam,
      joinRequests:[],
      discuss:[],
      filesArray:[]

    });
    team.save(function(err,doc){
      if(err)
      console.log(err);
      else{
        membersOfNewTeam.forEach(function(e){
          User.findByIdAndUpdate(e.id,{$push:{joinRequests:doc._id}},function(err){
            if(err)
            console.log(err);
          });
        });
        User.findByIdAndUpdate(team.members[0].id,{$push:{teams:doc._id}},function(err){
          if(err)
          console.log(err);
        });

      }
    });
    res.redirect("/user/"+req.params.user);
  }


});
//accept join request
app.post("/acceptJoinRequest/:user/:id",function(req,res){
  User.findOne({username:req.params.user},function(err,doc){
    if(err)
    console.log(err);
    else{
      doc.joinRequests.forEach(function(e,i){
        if(e==req.params.id){
          doc.joinRequests.splice(i,1);
        }
      });
      doc.teams.push(req.params.id);
      doc.save(function(err,doc){if(err)console.log(err);});
      Team.findById(req.params.id,function(error,docs){
        if(error)
        console.log(error);
        else{
          docs.yourJoinRequests.forEach(function(e,i){
            if(e.username==doc.username){
              docs.yourJoinRequests.splice(i,1);
            }
          });
          docs.members.push({id:doc._id,username:req.params.user});
          docs.save(function(err){if(err)console.log(err);});
        }
      });
      res.redirect("/user/"+req.params.user);
    }
  });
});
//send join request
app.post("/sendJoinRequest/:user/:id",function(req,res){
  User.findOne({username:req.params.user},function(err,doc){
    if(err)
    console.log(err);
    else{
      User.findOneAndUpdate({username:req.params.user},{$push:{yourJoinRequests:req.params.id}},function(err){if(err)console.log(err);});
      Team.findByIdAndUpdate(req.params.id,{$push:{joinRequests:{id:doc._id,username:req.params.user}}},function(err){if(err)console.log(err);});

    }
  });
  res.redirect("/user/yourJoinRequests/"+req.params.user);
});
app.post("/removeJoinRequest/:user/:id",function(req,res){
  Team.findById(req.params.id,function(err,docs){
    if(err)
    console.log(err);
    else{
      docs.joinRequests.forEach(function(e,i){
        if(e.username==req.params.user){
          docs.joinRequests.splice(i,1);
        }

        docs.save(function(err){
          if(err)
          console.log(err);
        });
      });

    }
  });
  User.findOne({username:req.params.user},function(err,doc){
    if(err)
    console.log(err);
    else{
      doc.yourJoinRequests.forEach(function(e,i){
        if(e==req.params.id)
        doc.yourJoinRequests.splice(i,1);
      });
      doc.save(function(err){
        if(err)
        console.log(err);
      });
    }
  });

  res.redirect("/user/yourJoinRequests/"+req.params.user);
});




app.get("/team/:user/:id",function(req,res){

   Team.findById(req.params.id,function(err,doc){
     if(err)
     console.log(err);
     else{


       res.render("team",{user:req.params.user,array:doc.filesArray,team:req.params.id,isDis:false,isJs:false});
     }
   });

});
app.post("/upload/:user/:id",upload.single("file"),function(req,res){
  console.log(req.file);
  const data={
    username:req.params.user,
    oldFileName:req.file.originalname,
    fileName:req.file.filename
  };
  Team.findByIdAndUpdate(req.params.id,{$push:{filesArray:data}},function(err){if(err)console.log(err);});
  res.redirect("/team/"+req.params.user+"/"+req.params.id);
});
app.get("/file/:filename",function(req,res){
  gfs.files.findOne({filename:req.params.filename},function(err,file){
    if(!file||file.length==0){
      res.send("No such file");
    }
    else{
      let readStream =gfs.createReadStream(file.filename);
      readStream.pipe(res);
    }
  });
});

app.get("/team/discussions/:user/:id",function(req,res){
  Team.findById(req.params.id,function(err,doc){
    if(err)
    console.log(err);
    else{
      res.render("team",{user:req.params.user,discuss:doc.discuss,isDis:true,team:req.params.id,isJs:false});
    }
  });
});
app.post("/team/discussions/:user/:id",function(req,res){

  Team.findByIdAndUpdate(req.params.id,{$push:{discuss:{username:req.params.user,message:req.body.message}}},function(err,doc){if(err)console.log(err);});
  res.redirect("/team/discussions/"+req.params.user+"/"+req.params.id);
});
app.get("/teamJss/joinRequests/:user/:id",function(req,res){
  //console.log("Hi");
  Team.findById(req.params.id,function(err,doc){
    if(err){
    console.log(err);
      //console.log("HIII");
    }
    else{
      //console.log("HI");
      res.render("team",{user:req.params.user,discuss:doc.joinRequests,isDis:false,team:req.params.id,isJs:true});
    }
  });
});
app.post("/teamJs/:user/:id/:status/:username",function(req,res){

  User.findOne({username:req.params.user},function(err,doc){
    if(err)
    console.log(err);
    else{
      doc.yourJoinRequests.forEach(function(e,i){
        if(e==req.params.id){
          doc.yourJoinRequests.splice(i,1);
        }

      });
      if(req.params.status=="accept"){
      doc.teams.push(req.params.id);}
      Team.findById(req.params.id,function(err,docs){
        if(err)
        console.log(err);
        else{
          docs.joinRequests.forEach(function(e,i){
            if(e.username==req.params.user){
                 docs.joinRequests.splice(i,1);
            }

          });
          if(req.params.status=="accept"){
            docs.members.push({id:doc._id,username:req.params.user});}
          docs.save(function(err){
              if(err)
              console.log(err);
            });
        }
      });


      doc.save(function(err){
        if(err)
        console.log(err);
      });
    }
  });


res.redirect("/teamJss/joinRequests/"+req.params.username+"/"+req.params.id);
});


// Listen
app.listen(3000,function(){
  console.log("Listening!");
});
