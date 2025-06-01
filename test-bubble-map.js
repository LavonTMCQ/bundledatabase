const { chromium } = require('playwright');

async function testBubbleMap() {
  console.log('🎭 Starting Playwright bubble map test...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Test 1: Simple Bubble Map
    console.log('📍 Testing simple bubble map...');
    await page.goto('http://localhost:8080/simple-bubble.html');
    await page.waitForLoadState('networkidle');
    
    // Click the SNEK button
    await page.click('text=🐍 Create SNEK Bubble Map');
    
    // Wait for bubble map to appear
    await page.waitForSelector('svg[id*="bubbleSvg"]', { timeout: 5000 });
    
    // Check if bubbles are created
    const bubbles = await page.locator('circle').count();
    console.log(`✅ Found ${bubbles} bubbles in SNEK bubble map`);
    
    // Test hover functionality
    const firstBubble = page.locator('circle').first();
    await firstBubble.hover();
    
    // Check if tooltip appears
    const tooltip = await page.locator('div:has-text("Rank:")').count();
    if (tooltip > 0) {
      console.log('✅ Tooltip functionality working');
    }
    
    // Close the modal
    await page.click('button:has-text("✕")');
    
    // Test 2: Debug Tool
    console.log('📍 Testing debug tool...');
    await page.goto('http://localhost:8080/debug-bubble.html');
    await page.waitForLoadState('networkidle');
    
    // Test Token API
    await page.click('text=Test Token API (SNEK)');
    await page.waitForTimeout(3000);
    
    const tokenOutput = await page.locator('#token-output').textContent();
    if (tokenOutput.includes('SUCCESS')) {
      console.log('✅ Token API working');
    } else {
      console.log('❌ Token API failed:', tokenOutput);
    }
    
    // Test Holder API
    await page.click('text=Test Holder API');
    await page.waitForTimeout(5000);
    
    const holderOutput = await page.locator('#holder-output').textContent();
    if (holderOutput.includes('SUCCESS')) {
      console.log('✅ Holder API working');
      
      // Test bubble map creation
      await page.click('text=Create Bubble Map');
      await page.waitForTimeout(2000);
      
      const bubbleMapExists = await page.locator('svg[id*="testBubbleSvg"]').count();
      if (bubbleMapExists > 0) {
        console.log('✅ Bubble map creation working');
      }
    } else {
      console.log('❌ Holder API failed:', holderOutput);
    }
    
    // Test 3: Main Application
    console.log('📍 Testing main application...');
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');
    
    // Type in chat
    await page.fill('#user-input', 'analyze SNEK');
    await page.press('#user-input', 'Enter');
    
    // Wait for response
    await page.waitForTimeout(8000);
    
    // Check if bubble map button appears
    const bubbleButton = await page.locator('button:has-text("🫧 View Bubble Map")').count();
    if (bubbleButton > 0) {
      console.log('✅ Main app analysis working');
      
      // Click bubble map button
      await page.click('button:has-text("🫧 View Bubble Map")');
      await page.waitForTimeout(3000);
      
      const mainBubbleMap = await page.locator('svg').count();
      if (mainBubbleMap > 0) {
        console.log('✅ Main app bubble map working');
      }
    } else {
      console.log('❌ Main app analysis failed');
    }
    
    console.log('🎉 Bubble map test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testBubbleMap();
