const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require("nodemailer");
const PDFDocument = require('pdfkit');
require("dotenv").config();

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const formattedDate = now.toISOString().replace(/:/g, '-');
        cb(null, `${formattedDate}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// MySQL Connection Pool
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: 'mysql12345',
    database: 'employee'
});

// Serve Uploaded Images
router.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Add Employee & Send Welcome Email
router.post('/add', upload.single('emp_photo'), (req, res) => {
    try {
        const { eno, ename, esal, egrade, emp_mail } = req.body;
        const emp_photo = req.file ? `/uploads/${req.file.filename}` : null;

        const query = 'INSERT INTO myemp (eno, ename, esal, egrade, emp_photo, emp_mail) VALUES (?, ?, ?, ?, ?, ?)';
        pool.query(query, [eno, ename, esal, egrade, emp_photo, emp_mail], (err) => {
            if (err) {
                console.error('Database Error:', err);
                return res.status(500).send('Error inserting employee.');
            }

            // Generate PDF
            const pdfPath = `public/uploads/Employee_Details_${eno}.pdf`;
            const doc = new PDFDocument();
            const stream = fs.createWriteStream(pdfPath);
            
            doc.pipe(stream);
            doc.fontSize(16).text("Employee Details", { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Employee No: ${eno}`);
            doc.text(`Name: ${ename}`);
            doc.text(`Salary: ${esal}`);
            doc.text(`Grade: ${egrade}`);
            doc.text(`Email: ${emp_mail}`);
            doc.moveDown();

            if (emp_photo) {
                const imagePath = path.join(__dirname, '../public', emp_photo);
                if (fs.existsSync(imagePath)) {
                    try {
                        doc.image(imagePath, { fit: [150, 150], align: 'center' });
                    } catch (err) {
                        console.error("PDFKit Image Error:", err);
                    }
                } else {
                    console.warn("Image not found:", imagePath);
                }}
                
            doc.end();
            stream.on('finish', () => {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: emp_mail,
                    subject: "Welcome to the Organization!",
                    text: `Hello ${ename},\n\nWelcome to our organization. Your details are attached in the PDF.\n\nBest Regards,\nYour Team`,
                    attachments: [{ filename: `Employee_Details_${eno}.pdf`, path: pdfPath }]
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error("Email Error:", error);
                        return res.status(500).json({ success: false, message: "Email could not be sent", error });
                    } else {
                        console.log("Email sent:", info.response);
                        return res.json({ success: true, message: "Employee added successfully & Welcome email sent!" });
                    }
                });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error while adding employee.');
    }
});

  //listing records
  router.get('/list', (req, res) => {
    const query = 'SELECT * FROM myemp';
    pool.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching records');
        }
        console.log('Fetched records:', results); // Debugging line
        res.render('list', { records: results });
    });
});


// Search Employee
router.post('/search', (req, res) => {
    const { eno } = req.body;
    const query = 'SELECT * FROM myemp WHERE eno = ?';
    pool.query(query, [eno], (err, results) => {
        if (err) return res.status(500).send('Error fetching records');
        res.render('search_result', { record: results[0] });
    });
});

// Fetch Employee for Update
router.get('/update/:eno', (req, res) => {
    const { eno } = req.params;
    const query = 'SELECT * FROM myemp WHERE eno = ?';
    pool.query(query, [eno], (err, results) => {
        if (err) return res.status(500).send('Error fetching employee details.');
        res.render('update_form', { record: results[0] });
    });
});

// Update Employee
router.post('/update', upload.single('emp_photo'), (req, res) => {
    const { eno, ename, esal, egrade, emp_mail } = req.body;
    let emp_photo = req.file ? `/uploads/${req.file.filename}` : null;
    
    const checkQuery = 'SELECT emp_photo FROM myemp WHERE eno = ?';
    pool.query(checkQuery, [eno], (err, results) => {
        if (err || results.length === 0) return res.status(500).send('Error fetching employee.');
        if (!emp_photo) emp_photo = results[0].emp_photo;
        
        const updateQuery = 'UPDATE myemp SET ename=?, esal=?, egrade=?, emp_photo=?, emp_mail=? WHERE eno=?';
        pool.query(updateQuery, [ename, esal, egrade, emp_photo, emp_mail, eno], (err) => {
            if (err) return res.status(500).send('Error updating employee.');
            res.send('Employee updated successfully!');
        });
    });
});

// Delete Employee
router.post('/delete', (req, res) => {
    const { eno } = req.body;
    pool.query('DELETE FROM myemp WHERE eno = ?', [eno], (err, result) => {
        if (err) return res.status(500).send("Internal Server Error");
        res.redirect("/myemp/list?msg=Employee Deleted Successfully");
    });
});

// View Employee Details
router.get('/view/:eno', (req, res) => {
    const { eno } = req.params;
    const query = 'SELECT * FROM myemp WHERE eno = ?';
    
    pool.query(query, [eno], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).send('Error fetching employee details.');
        }
        res.render('view', { employee: results[0] });
    });
});


// Generate & Download Employee PDF
router.get('/download/:eno', (req, res) => {
    const { eno } = req.params;
    const query = 'SELECT * FROM myemp WHERE eno = ?';

    pool.query(query, [eno], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).send('Error fetching employee details.');
        }

        const employee = results[0];
        const pdfPath = `public/uploads/Employee_Details_${eno}.pdf`;
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(pdfPath);

        doc.pipe(stream);
        doc.fontSize(16).text("Employee Details", { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Employee No: ${employee.eno}`);
        doc.text(`Name: ${employee.ename}`);
        doc.text(`Salary: ${employee.esal}`);
        doc.text(`Grade: ${employee.egrade}`);
        doc.text(`Email: ${employee.emp_mail}`);
        doc.moveDown();

        if (employee.emp_photo) {
            const imagePath = path.join(__dirname, '../public', employee.emp_photo);
            if (fs.existsSync(imagePath)) {
                try {
                    doc.image(imagePath, { fit: [150, 150], align: 'center' });
                } catch (err) {
                    console.error("PDFKit Image Error:", err);
                }
            } else {
                console.warn("Image not found:", imagePath);
            }
        }

        doc.end();

        stream.on('finish', () => {
            res.download(pdfPath, `Employee_Details_${eno}.pdf`);
        });
    });
});


module.exports = router;
