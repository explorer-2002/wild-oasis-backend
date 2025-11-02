export class AppError extends Error{
    constructor(message, statusCode){
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = async (err, req, res, next) => {
    let error = {...err};
    error.message = err.message;

    if(err.name === 'CastError'){
        const message = 'Invalid resource id';
        error = new AppError(message, 400);
    }

    if(err.code === 11000){
        const message = "Duplicate field value entered";
        error = new AppError(message, 400);
    }

    if(err.name === 'ValidationError'){
        const message = Object.values(err.errors).map(val => val.message).join('. ');
        error = new AppError(message, 400);
    }

    if(err.isJoi){
        const message = err.details.map(detail => detail.message).join('. ');
        return res.status(400).json({
            success: false,
            error: message
        });
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Server error"
    })
}