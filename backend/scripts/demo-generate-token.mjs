import "../config/loadEnv.js";
import generateToken from "../utils/generateToken.js";

const demoUserId = "507f1f77bcf86cd799439011";
console.log(generateToken(demoUserId));
