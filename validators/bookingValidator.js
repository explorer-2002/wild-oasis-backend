import Joi from 'joi';

export const createBookingSchema = Joi.object({
    roomId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Invalid room format',
    }),

    guestName: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Guest name must be at least 2 characters',
        'string.max': 'Guest name cannot exceed 100 characters'
    }),

    guestEmail: Joi.string().email().required().messages({
        'string.email': "Invalid email format"
    }),

    guestPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
        .messages({
            'string.pattern.base': 'Invalid phone number format'
        }),

    checkInDate: Joi.date().iso().min('now').required().messages({
        'date.min': 'Check-in date must be in the future'
    }),

    checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')).required()
        .messages({
            'date.greater': 'Check-out date must be after check-in date'
        }),

    numberOfGuests: Joi.number().integer().min(1).max(10).required()
        .messages({
            'number.min': 'At least 1 guest is required',
            'number.max': 'Maximum 10 guests allowed'
        }),

    totalPrice: Joi.number().integer().min(1000).max(100000).required()
        .messages({
            'number.min': 'Total price must be at least 1000',
            'number.max': 'Total price should atmost be 100000'
        }),

    pricePerNight: Joi.number().integer().min(1000).max(10000).required()
        .messages({
            'number.min': 'At least 1000 price is required',
            'number.max': 'Maximum 10000 price allowed'
        }),

    specialRequests: Joi.string().max(200).allow('').optional()
});

export const updateBookingSchema = Joi.object({
    checkInDate: Joi.date().iso().min('now').optional(),
    checkOutDate: Joi.date().iso().optional(),
    numberOfGuests: Joi.number().integer().min(1).max(10).optional(),
    specialRequests: Joi.string().max(500).allow('').optional(),
    status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled').optional()
}).custom((value, helpers) => {
    if (value.checkInDate && value.checkOutDate) {
        if (new Date(value.checkOutDate) <= new Date(value.checkInDate)) {
            return helpers.error('any.invalid', { message: "Check-out date must be after check-in date" })
        }
    }

    return value;
});

export const querySchema = Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled').optional(),
    roomId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    guestEmail: Joi.string().email().optional(),
    checkInDate: Joi.date().iso().optional(),
    checkOutDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
})