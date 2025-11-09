export const validate = (schema) => {
    return (req, res, next) => {
        const {error} = schema.validate(req.body, {abortEarly: false});

        if(error){
            // return next(error);
            return res.status(500).json({
                success: false,
                message: error
            });
        }

        next();
    }
}

export const validateQuery = (schema) => {
    return (req, res, next) => {
        const {error, value} = schema.validate(req.query, {abortEarly: false});

        if(error){
            return next(error);
        }

        req.query = value;
        next();
    }
}
