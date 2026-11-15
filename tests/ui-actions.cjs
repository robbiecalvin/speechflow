// Exercise the visible navigation path when an advanced action lives in More.
async function reveal(page,selector){
  const target=page.locator(selector);
  if(await target.isVisible())return;
  const inTools=await target.evaluate(el=>!!el.closest('#moreModal'));
  if(inTools){
    const mobile=page.locator('#mobileMore');
    await (await mobile.isVisible()?mobile:page.locator('#moreTools')).click();
  }
}
async function click(page,selector){
  await reveal(page,selector);
  await page.locator(selector).click();
  if(await page.locator('#moreModal').isVisible())await page.locator('#closeMore').click();
}
module.exports={click,reveal};
