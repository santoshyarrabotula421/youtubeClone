import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from  "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
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

   const {fullName,username,email,password} = req.body
   console.log("email : ",email)
   
   /*if(fullname === "")
   {
    throw new ApiError(400,"fullName is Required")
   }*/
   if(
    [fullName,email,username,password].some((field)=> field?.trim()==="")
    )
   {
    throw new ApiError(400,"All fields are required")
   }

   const existedUser = User.findOne({
    $or: [{username}, {email}]
   })

   if(existedUser)
   {
    throw new ApiError(409,"user with email or username already exists")
   }
   /* we know all the data will comes from req.body*/
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path
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
   fullName,
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

export { registerUser }