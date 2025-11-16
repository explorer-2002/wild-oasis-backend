import express from 'express';
import { Room } from '../models/Room.js';
import { upload } from '../upload.js';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Image } from '../models/ImageModel.js';
import sendSms from '../services/sendSms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

router.post('/room', upload.single('image'), async (req, res, next) => {
    try {
        let obj = {
            name: req.body.roomNumber,
            desc: req.body.roomNumber,
            img: {
                data: fs.readFileSync(path.join(__dirname, '..', 'uploads', req.file.filename)),
                contentType: 'image/png'
            }
        }

        const image = await Image.create(obj);

        const room = await Room.create({
            roomNumber: req.body.roomNumber,
            roomType: req.body.roomType,
            pricePerNight: req.body.pricePerNight,
            maxGuests: req.body.maxGuests,
            isActive: req.body.isActive,
            imageId: image._id
        });

        sendSms(`New room created numbered ${req.body.roomNumber}`);

        return res.json({
            message: "success",
            data: room
        });
    }

    catch (error) {
        console.log(error);
        return res.json({ error: error });
    }
});

router.patch('/room/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updatedRoom = await Room.findByIdAndUpdate(id, updateData, { new: true });

        res.json({
            message: 'success',
            data: updatedRoom
        })
    }

    catch (error) {
        res.json({
            error: error
        })
    }
});

router.get('/rooms', async (req, res) => {
    try {
        const roomsWithImages = await Room.aggregate([
            {
                $lookup: {
                    from: 'images',
                    localField: 'imageId',
                    foreignField: '_id',
                    as: 'imageData'
                }
            },
            {
                $unwind: {
                    path: '$imageData',
                    preserveNullAndEmptyArrays: true
                }
            }
        ]);

        // Convert buffers to base64
        const formatted = roomsWithImages.map(room => ({
            _id: room._id,
            name: room.roomNumber,
            capacity: room.roomType,
            price: room.pricePerNight,
            maxGuests: room.maxGuests,
            image: room.imageData?.img ?
                `data:${room.imageData?.img?.contentType};base64,${room.imageData?.img?.data?.toString('base64')}`
                : null
        }));

        res.status(200).json(formatted);
    }

    catch (err) {
        res.status(500).json({ message: "Error fetching rooms", error: err })
    }
})

router.delete('/room/:id', async (req, res) => {

    try{
    const {id} = req.params;

    const deletedRoom = await Room.findByIdAndDelete(id);

    res.json({data: deletedRoom});
    }

    catch(err){
        res.json({error: err});
    }
});

export default router;