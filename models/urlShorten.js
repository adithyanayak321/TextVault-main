
    const mongoose = require('mongoose');

    const urlSchema = new mongoose.Schema({
        longURL: String,
        shortURL: String,
        shortID: String
    })


    module.exports = mongoose.model('URL', urlSchema);