Challenge 1: Build a Hotel Booking API 
Create a RESTful API for a hotel room booking system with the following requirements:
Required Endpoints:
POST   /api/bookings        - Create a new booking
GET    /api/bookings/:id    - Get booking details
GET    /api/bookings        - List all bookings (with filters)
PATCH  /api/bookings/:id    - Update booking
DELETE /api/bookings/:id    - Cancel booking

Business Rules:
Check-in date must be before check-out date
Cannot book a room that's already booked for overlapping dates
Calculate total price: numberOfNights × roomPricePerNight
Booking status can be: pending, confirmed, cancelled, completed
Validate all inputs properly
Sample Request Body:
POST /api/bookings
{
  "roomId": "507f1f77bcf86cd799439011",
  "guestName": "John Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+91-9876543210",
  "checkInDate": "2025-10-20",
  "checkOutDate": "2025-10-25",
  "numberOfGuests": 2,
  "specialRequests": "Late check-in preferred"
}

What We're Looking For:
Proper Express.js route structure
Input validation (using Joi, express-validator, or custom)
Error handling middleware
MongoDB schema design (or explain your schema)
Prevention of double booking
Appropriate HTTP status codes
