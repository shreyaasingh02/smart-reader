const { createClient } = require("@supabase/supabase-js");

// creating a connection that our backend can communicate with the supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);   

module.exports = supabase;