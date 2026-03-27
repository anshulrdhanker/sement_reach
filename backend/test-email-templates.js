const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://wuoixzhwqgxphmyeyvrz.supabase.co';
const supabaseKey = 'supabase_key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEmailTemplates() {
  console.log('Testing access to email_templates table...');
  
  try {
    // Test 1: Try to read from email_templates table
    console.log('\n🔍 Reading from email_templates table...');
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .limit(5); // Get up to 5 templates
    
    if (error) throw error;
    
    console.log('✅ Successfully connected to email_templates table!');
    
    if (templates && templates.length > 0) {
      console.log(`\nFound ${templates.length} email template(s):`);
      templates.forEach((template, index) => {
        console.log(`\nTemplate #${index + 1}:`);
        console.log('ID:', template.id);
        console.log('Name:', template.template_name || 'No name');
        console.log('Category:', template.template_category || 'No category');
        console.log('Is Active:', template.is_active ? 'Yes' : 'No');
        // Show a preview of the opener text
        const preview = template.opener_text 
          ? `${template.opener_text.substring(0, 50)}...` 
          : 'No content';
        console.log('Opener Preview:', preview);
      });
    } else {
      console.log('No email templates found in the database.');
    }

  } catch (error) {
    console.error('❌ Error accessing email_templates:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
  }
}

testEmailTemplates();
