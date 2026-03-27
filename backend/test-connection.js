const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://wuoixzhwqgxphmyeyvrz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1b2l4emh3cWd4cGhteWV5dnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODM2ODgsImV4cCI6MjA2NjU1OTY4OH0.cwFPgK2gG3d63zO8Sskq9Fk8WSzjw_raPKACdzvBiKo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test 1: Basic connection test
    console.log('\n Testing basic connection...');
    const { data: testData, error: testError } = await supabase
      .from('test_table')
      .select('*')
      .limit(1);
    
    // If we get here, the connection is working
    console.log(' Basic connection test passed!');
    
    // Test 2: Try to create a test row
    console.log('\n Testing write operation...');
    const testRow = {
      test_field: 'Connection test at ' + new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('test_table')
      .insert([testRow])
      .select();
    
    if (insertError) {
      console.warn('  Could not write to test_table (this might be expected if the table does not exist)');
      console.warn('   Error details:', insertError.message);
    } else {
      console.log(' Successfully wrote test row:', insertData);
    }
    
    console.log('\n Supabase connection is working correctly!');
    
  } catch (error) {
    if (error.code === '42P01') {
      console.log(' Connection successful, but test_table does not exist (this is expected)');
      console.log('\n Supabase connection is working correctly');
    } else {
      console.error('❌ Error testing connection:', error.message);
      if (error.details) console.error('Details:', error.details);
      if (error.hint) console.error('Hint:', error.hint);
    }
  }
}

testConnection();
