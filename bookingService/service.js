export class BookingService {
    constructor(Booking, Room) {
        this.Booking = Booking;
        this.Room = Room;
    }

    calculateNights(checkIn, checkOut) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const diffTime = new Date(checkOut) - new Date(checkIn);
        return Math.ceil(diffTime / msPerDay);
    }

    async isRoomAvailable(roomId, checkInDate, checkOutDate, excludeBookingId = null) {
        const query = {
            roomId,
            status: { $nin: ['canelled'] },
            $or: [
                {
                    checkInDate: { $lt: checkOutDate },
                    checkOutDate: { $gt: checkInDate }
                }
            ]
        }

        if (excludeBookingId) {
            query._id = { $ne: excludeBookingId };
        }

        const overlappingBooking = await this.Booking.findOne(query);
        return !overlappingBooking;
    }

    async createBooking(bookingData) {
        const { roomId, checkInDate, checkOutDate, numberOfGuests } = bookingData;

        const room = await this.Room.findById(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (!room.isActive) {
            throw new Error("Room is not available for booking");
        }

        if (numberOfGuests > room.maxGuests) {
            throw new Error(`Room can't accomodate more than ${room.maxGuests} guests`);
        }

        const isAvailable = await this.isRoomAvailable(roomId, checkInDate, checkOutDate);
        if (!isAvailable) {
            throw new Error('Room is already booked for the selected dates');
        }

        const numberOfNights = this.calculateNights(checkInDate, checkOutDate);
        const totalPrice = numberOfNights * room.pricePerNight;

        const booking = new this.Booking({
            ...bookingData,
            numberOfNights,
            pricePerNight: room.pricePerNight,
            totalPrice,
            status: 'pending'
        });

        await booking.save();

        const populatedBooking = await booking.populate('roomId');

        return populatedBooking;
    }

    async getBookingById(bookingId) {
        const booking = await this.Booking.findById(bookingId);

        if (!booking) {
            throw new Error("Booking not found");
        }

        return booking;
    }

    async getAllBookings(filters = {}) {
        const { status, roomId, guestEmail, checkInDate, checkOutDate, page = 1, limit = 10 } = filters;

        const query = {};

        if (status) query.status = status;
        if (roomId) query.roomId = roomId;
        if (guestEmail) query.guestEmail = guestEmail;
        if (checkInDate) query.checkInDate = { $gte: new Date(checkInDate) };
        if (checkOutDate) query.checkOutDate = { $lte: new Date(checkOutDate) };

        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            this.Booking.find(query)
                .populate('roomId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            this.Booking.countDocuments(query)
        ]);

        return {
            bookings,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        }

    }

    async updateBooking(bookingId, updateData) {
        const booking = await this.Booking.findById(bookingId);

        if (!booking) {
            throw new Error("Booking not found");
        }

        if (booking.status === 'cancelled') {
            throw new Error('Cannot update a cancelled booking');
        }

        const newCheckIn = updateData.checkInDate || booking.checkInDate;
        const newCheckOut = updateData.checkOutDate || booking.checkOutDate;

        if (updateData.checkInDate || updateData.checkOutDate) {
            const isAvailable = await this.isRoomAvailable(
                booking.roomId,
                newCheckIn,
                newCheckOut,
                bookingId
            )


            if (!isAvailable) {
                throw new Error('Room is not available for the updated dates');
            }

            const numberOfNights = this.calculateNights(newCheckIn, newCheckOut);
            updateData.numberOfNights = numberOfNights;
            updateData.totalPrice = numberOfNights * booking.pricePerNight;
        }

        Object.assign(booking, updateData);
        await booking.save();
        const populatedBooking = await booking.populate('roomId');

        return populatedBooking;
    }

    async cancelBooking(bookingId) {
        const booking = await this.Booking.findById(bookingId);

        if (!booking) {
            throw new Error("Booking not found");
        }

        if (booking.status === 'cancelled') {
            throw new Error('Booking is already cancelled');
        }

        if (booking.status === 'completed') {
            throw new Error('Cannot cancel a completed booking');
        }

        booking.status = 'cancelled';
        await booking.save();
        return await booking.populate('roomId');
    }
}