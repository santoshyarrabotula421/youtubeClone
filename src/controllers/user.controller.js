import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from  "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {User} from "../models/user.model.js"
import {upload} from "../middlewares/multer.middleware.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId)=>
{
  try{
   const user = await User.findById(userId)
   const accessToken =  user.generateAccessToken()
   const refreshToken = user.generateRefreshToken()

   user.refreshToken = refreshToken
   await user.save({validateBeforeSave : false})

   return {accessToken,refreshToken}
  }catch(error)
  {
    throw new ApiError(500,"Something went wrong while generating refresh and access token")
  }
}


const registerUser =asyncHandler( async (req,res)=>{
   // get the user details from frontend.
   //in user model we maintained username,email,fullname,avatar,coverImage,password
   // validation (valid email,not empty)
   // check if user already exists :username,email
   // check for images , check for avatar
   // upload them to cloudinary , avatar
   // create user object - create entry in db
   // remove password and refresh token field from response
   // checking for user creation response
   // return response

   const {fullname,username,email,password} = req.body
   console.log("email : ",email)
   
   console.log("REQ FILES:", req.files);
   console.log("REQ BODY:", req.body);
   /*if(fullname === "")
   {
    throw new ApiError(400,"fullName is Required")
   }*/
   if(
    [fullname,email,username,password].some((field)=> field?.trim()==="")
    )
   {
    throw new ApiError(400,"All fields are required")
   }

   const existedUser = await User.findOne({
    $or: [{username}, {email}]
   })

   if(existedUser)
   {
    throw new ApiError(409,"user with email or username already exists")
   }
   /* we know all the data will comes from req.body*/
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  if(!avatarLocalPath)
  {
   throw new ApiError(400,"Avatar file is required")
  }
 const avatar =  await uploadOnCloudinary(avatarLocalPath)
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)

 if(!avatar)
 {
   throw new ApiError(400,"Avatar file is required")
 }
  
 const user = await User.create({
   fullname,
   avatar : avatar.url,
   coverImage : coverImage?.url || "",
   email ,
   password,
   username : username.toLowerCase()
 })
// mongodb automatically gives _id 

// intially by default all the field are selected. by below line we need mention what we need to remove.

 const createdUser = await User.findById(user._id).select(
   "-password -refreshToken"
 )
 if(!createdUser)
 {
   throw new ApiError(500,"Something went wrong while registering the user")
 }

 return res.status(201).json(
   new ApiResponse(200,createdUser,"User created succesfully")
 )

})

const loginUser = asyncHandler(async (req,res)=>{
    // take data from req body
    // username or email
    //find the user
    //password check
    //access token,refresh token generation
    //send cookie
    const {email,username,password} = req.body
    if(!(username || email))
    {
      throw new ApiError(400,"Username or email is required")
    }

    const user = await User.findOne({
     username:"santosh"
    })
    // console.log(user);
    if(!user)
    {
      throw new ApiError(404,"User doesn't exist")
    }
   const isValidPassword =  await user.isPasswordCorrect(password)
   if(!isValidPassword)
   {
    throw new ApiError(401,"Incorrect Password")
   }
   
    
   const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

   
  const loggedInUser = await User.findById(user._id).select("-password")

  const options = {
    httpOnly : true, // by ensuring these two only servers can modify these.
    secure : true
  }
  
  return res.status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(200,
      {
        user : loggedInUser,accessToken,refreshToken
      },
      "User loggedIn succesfully"
    )
  )


})

const logoutUser = asyncHandler(async (req,res)=>{
  // for login we used username and password to find a user. but here in logout how we actually find the user is the task.
  // here we need to know some concept of middleware
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken:undefined
      }
    },
    {
      new:true
    }
  )

  const options = {
    httpOnly : true, // by ensuring these two only servers can modify these.
    secure : true
  }

  return res.status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(
    new ApiResponse(200,{},"User logged out succesfully ")
  )

})

const refreshAccessToken = asyncHandler(async(req,res)=>{
  const incomingRefreshToken = req.cookies.refreshToekn || req.body.refreshToken
  if(!incomingRefreshToken)
  {
    throw new ApiError(401,"Unoauthorized request")
  }
  try{
  const decodedToken =  jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

  const user =  await User.findById(decodedToken?._id)
  if(!user)
  {
    throw new ApiError(401,"Invalid refresh token")
  }

  if(incomingRefreshToken !== user?.refreshToken)
  {
    throw new ApiError(401,"Refresh token is expired or used")
  }

  const options = {
    httpOnly : true,
    secure : true
  }

  const {accessToke,newrefreshToken} = await generateAccessAndRefreshTokens(user._id)

  return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",newrefreshToken,options).json(
    new ApiResponse(200,{accessToken,refreshToken : newrefreshToken},
      "Access token refreshed"
    )
  )
}catch(error)
{
  throw new ApiError(401,error?.message || "Invalid refresh Token")
}

})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
  const {oldPassword, newPassword} = req.body

  const user  = await User.findById(req.user?._id)
  const isPasswordCorrect = await  user.isPasswordCorrect(password)
  if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid Password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave : false})

  return res.status(200)
  .json(new ApiError(200,{},"Password changed succesfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
  return res.status(200).json(200,req.user,"current user fetched succesfully")
})
 // for files we will write separate controller
const updateAccountDetails = asyncHandler(async(req,res)=>{
  const  {fullname,email,} = req.body
  if(!fullname || !email)
  {
    throw new ApiError(400,"all fields are required")
  }
   
  const user = User.findByIdAndUpdate(req.user?._id,{
    $set : {
      fullname,
      email
    } 
  },{new : true}).select("-password")

  res.status(2000).json(
    new ApiResponse(200,user,"Account details updated succesfully")
  )
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
 const avatarLocalPath =  req.file?.path
 if(!avatarLocalPath)
 {
  new ApiError(400,"Avatar file is missing")
 }
 const avatar = await uploadOnCloudinary(avatarLocalPath)

 if(!avatar.url)
 {
  throw new ApiError(500,"Error while uploading on avatar")
 }

const user =  await User.findAndUpdateById(req.user?._id,
 {
  $set : {
    avatar : avatar.url
  }
 },{new : true}).select("-password")

return res.status(200).json(
  new ApiResponse(200,user,"Cover image updated succesfully"))

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
 const coverImageLocalPath =  req.file?.path
 if(!coverImageLocalPath)
 {
  new ApiError(400,"Avatar file is missing")
 }
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)

 if(!coverImage.url)
 {
  throw new ApiError(500,"Error while uploading on avatar")
 }

const user =  await User.findAndUpdateById(req.user?._id,
 {
  $set : {
    coverImage : coverImage.url
  }
 },{new : true}).select("-password")

 return res.status(200).json(
  new ApiResponse(200,user,"Cover image updated succesfully")
 )

})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
  const {username} = req.params 
  if(!username?.trim())
  {
    throw new ApieError(400,"username is missing")
  }
  // const user  = await User.find({username})

  //aggregation pipeline that gets the array of subscribers to a channel
  
const channel = await User.aggregate([   
  {
    $match : {username : username?.toLowerCase()}
  },
  {
    $lookup : {
      from :"subscriptions" ,
      localField : "_id",
      foreignField : "channel",
      as : "subscribers"
    }
  },
  {
    $lookup : {
      from :"subscriptions" ,
      localField : "_id",
      foreignField : "subscriber",
      as : "subscribedTo"
    }
  },
  {
    $addFields : {
      subscribersCount : {
        $size : "$subscribers"
      },
      channelsSubscribedToCount : {
        $size : "$subscribedTo"
      },
      isSubscribed : {
        $cond : {
          if : {$in : [req.user?._id,"$subscribers.subscriber"]},
          then : true, // $in checks whether it is present in array, or in object
          else : false
        }
      }
    }
  },
  {
    $project : { // it select only some fields , acts as select in mysql
      subscribersCount : 1,
      channelsSubscribedToCount : 1,
      isSubscribed : 1,
      fullname : 1,
      avatar : 1,
      coverImage : 1,
      username : 1,
      email : 1
    }
  }
])
 // aggregtion pipelines returns an array with multiple values. but in our case only document is retrived as output.
console.log(channel)

if(!channel?.length)
{
  throw new ApiError(404,"channel does not exist")
}

  return res.status(200)
  .json(
    new ApiResponse(200,channel[0],"User channel fetched succesfully")
  )

})

const getWatchHistory = asyncHandler(async(req,res)=>{
  const user = await User.aggregate([
    {
      $match : {
        _id : new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup : {
          from : "videos",
          localField : "watchHistory",
          foreignField : "_id",
          as : "watchHistory",
          pipeline : [
            {
            $lookup : {
              from : "users",
              localField : "owner",
              foreignField : "_id",
              as : "owner",
              pipeline : [
                {
                  $project : {
                    fullname : 1,
                    username : 1,
                    avatar : 1
                  }
                }
              ]
            }
            },
            {
              $addField :{
                owner :{
                  $first : "$owner"
                }
              }
            }
          ]
        }
    }
  ])

  return res.status(200).json(
    new ApiResponse(200,user[0].watchHistory,"Watch history fetched succesfully")
  )

})



export { registerUser,
    loginUser,
    logoutUser, 
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
  }