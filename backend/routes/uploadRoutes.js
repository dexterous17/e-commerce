//this route is for uploading and config for multer
import path from "path";
import express from "express";
import multer from "multer";
import { fileURLToPath } from "url";

import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();
const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const uploadsDir = path.join(backendRoot, "uploads");

//innitializing multer storage engine and create config
//pass in object with two functions
//with destination, call the callback with null, meaning there is no error, and where we want to upload to
//with filename, pass in null for no error, and then what we want to name the file
//we dont want to use the original file name, because that might lead to duplicates if some of the files have the same name
//take the fieldname add - and the timestamp, and the node path extension can get the extension name (.jpg .png ect)
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

//function with calidation expression that limits what files will be able to uploaded
function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png/;
  //test will give us a true or false if it matches the extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  //also want to check mimetype (image/jpg ect)
  const mimetype = filetypes.test(file.mimetype);

  //if both extname and mimetype pass the test, pass the cb with no error and true, else, pass the error
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Images only!"));
  }
}

//middleware that we are going to pass to our route
//you can limit what types of files you can upload into the route with filefilter
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

//this file is connected to /api/upload
//.single means we are uploading just one image
//when we call it on the front end we need to also call it image
router.post("/", protect, admin, (req, res, next) => {
  upload.array("image", 16)(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    const files = req.files || [];
    res.json(
      files.map((file) => ({
        ...file,
        path: path.posix.join("uploads", file.filename),
      }))
    );
  });
});

export default router;
