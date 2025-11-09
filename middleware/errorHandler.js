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
    error.message = err?.message;

    if(err.name === 'CastError'){
        const message = 'Invalid resource id';
        error = new AppError(message, 400);
    }

    if(err.code === 11000){
        const message = "Duplicate field value entered";
        error = new AppError(message, 400);
    }

    if(err.name === 'ValidationError'){
        const message = Object.values(err?.errors).map(val => val.message).join('. ');
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
        error: error?.message || "Server error"
    })
}

// export const errorHandler = (err, req, res, next) => {
//   // Set default values if not already present
//   const statusCode = err.statusCode || 500;
//   const status = err.status || 'error';
//   let message = err.message;

//   // SPECIFIC ERROR HANDLING
//   // This is the crucial part that prevents the crash.
//   // We check if the error is a Mongoose ValidationError before trying to access err.errors
//   if (err.name === 'ValidationError') {
//     // Join all the Mongoose validation error messages into one string
//     const errors = Object.values(err.errors).map(el => el.message);
//     message = `Invalid input data: ${errors.join('. ')}`;
//     // Override status code for validation errors
//     statusCode = 400; 
//   }

//   // Send a clean response to the client
//   res.status(statusCode).json({
//     status: status,
//     message: message,
//     // Optionally include the stack trace during development
//     // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// };