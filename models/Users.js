import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    id: {
        type:String,
        required: true,
        unique: true,
        index: true,
        sparse: true
    },

    userName: {
        type: String,
        required: true
    },

    role: {
        type: String,
        required: true,
        enum: ['user', 'admin'],
        default: 'user'
    },

    userEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },

    avatar: {
        type: String,
    },

    mobileNumber: {
        type: String,
    },
});

export const User = mongoose.model('User', userSchema);
