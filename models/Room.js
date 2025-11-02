import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true
    },

    roomType: {
        type: String,
        required: true
    },

    pricePerNight: {
        type: Number,
        required: true
    },

    maxGuests: {
        type: Number,
        required: true
    },

    isActive: {
        type: Boolean,
        default: true
    },

    imageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image'
    },
}, {
    timestamps: true
});

export const Room = mongoose.model('Room', roomSchema);