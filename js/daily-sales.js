let dsStores=[],dsRows=[],dsEditId="";
function dsGetCurrentUser(){if(typeof getCurrentUser==="function")return getCurrentUser();if(typeof currentUser!=="undefined"&&currentUser)return currentUser;try{return JSON.parse(sessionStorage.getItem("currentUser")||"null")}catch(e){return null}}
function dsHasAccess(){return typeof requirePermission==="function"?requirePermission("daily_sales"):true}
async function openDailySales(){if(!dsHasAccess())return;document.getElementById("dailySalesContainer")?.style.setProperty("display","block");document.getElementById("homeContainer")?.style.setProperty("display","none");document.getElementById("otModule")?.style.setProperty("display","none");document.getElementById("userManagementContainer")?.style.setProperty("display","none");await dsLoad()}
async function dsLoad(){const u=dsGetCurrentUser()||{};const [a,b]=await Promise.all([callAPI("getDailySalesStores",{username:u.username||""}),callAPI("getDailySalesList",{username:u.username||""})]);if(!a?.status){dsShowError(a?.message||"Unable to load Store data.");return}if(!b?.status){dsShowError(b?.message||"Unable to load Daily Sales.");return}dsStores=a.stores||[];dsRows=b.rows||[];dsPopulateStoreSelect();dsRenderTable()}
function dsPopulateStoreSelect(){const s=document.getElementById("dsStoreNo");if(!s)return;s.innerHTML='<option value="">Select Store No</option>';dsStores.forEach(x=>{const o=document.createElement("option");o.value=x.storeNo;o.textContent=`${x.storeNo} - ${x.storeName}`;s.appendChild(o)})}
function dsStoreChanged(){const no=document.getElementById("dsStoreNo")?.value||"";const x=dsStores.find(v=>String(v.storeNo)===String(no));["dsStoreName","dsOperatingHour","dsOpeningDate","dsBudgetSales","dsPersonInCharge"].forEach(id=>dsSet(id,""));if(!x)return;dsSet("dsStoreName",x.storeName);dsSet("dsOperatingHour",x.operatingHour);dsSet("dsOpeningDate",x.openingDate);dsSet("dsBudgetSales",dsMoney(x.budgetSales));dsSet("dsPersonInCharge",x.personInCharge);dsCalculate()}
function dsSet(id,v){const e=document.getElementById(id);if(e)e.value=v??""}function dsGet(id){return document.getElementById(id)?.value?.trim()||""}
function dsOpenAdd(){if(!dsHasAccess())return;dsEditId="";dsResetFields();document.getElementById("dsFormTitle").textContent="Add Daily Sales";dsSet("dsDailySalesNo","Auto Generate");dsSet("dsTransactionSize","0.00");dsSet("dsPercentage","0.00%");dsToggleForm(true)}
function dsOpenEdit(id){if(!dsHasAccess())return;const r=dsRows.find(x=>String(x.dsId)===String(id));if(!r)return dsShowError("Daily Sales record not found.");dsEditId=r.dsId;document.getElementById("dsFormTitle").textContent="Edit Daily Sales";dsSet("dsDailySalesNo",r.dailySalesNo);dsSet("dsStoreNo",r.storeNo);dsStoreChanged();dsSet("dsBusinessDate",dsToInputDate(r.businessDate));dsSet("dsTotalSales",r.totalSales);dsSet("dsTotalMerchandiseSales",r.totalMerchandiseSales);dsSet("dsServices",r.services);dsSet("dsFood",r.food);dsSet("dsBeverage",r.beverage);dsSet("dsGeneralMerchandise",r.generalMerchandise);dsSet("dsTobacco",r.tobacco);dsSet("dsSupply",r.supply);dsSet("dsFoodService",r.foodService);dsSet("dsAlcoholic",r.alcoholic);dsSet("dsTotalCustomer",r.totalCustomer);dsCalculate();dsToggleForm(true)}
function dsResetFields(){["dsDailySalesNo","dsStoreNo","dsBusinessDate","dsStoreName","dsOperatingHour","dsOpeningDate","dsBudgetSales","dsPersonInCharge","dsTotalSales","dsTotalMerchandiseSales","dsServices","dsFood","dsBeverage","dsGeneralMerchandise","dsTobacco","dsSupply","dsFoodService","dsAlcoholic","dsTotalCustomer","dsTransactionSize","dsPercentage"].forEach(id=>dsSet(id,""));dsSet("dsDailySalesNo","Auto Generate");dsSet("dsTransactionSize","0.00");dsSet("dsPercentage","0.00%");}
function dsCloseForm(){dsToggleForm(false);dsEditId=""}function dsToggleForm(show){document.getElementById("dailySalesFormWrapper")?.style.setProperty("display",show?"block":"none");if(show)document.getElementById("dailySalesFormWrapper")?.scrollIntoView({behavior:"smooth",block:"start"})}
async function dsSave(){if(!dsHasAccess())return;const storeNo=dsGet("dsStoreNo"),businessDate=dsGet("dsBusinessDate");if(!storeNo)return dsShowError("Please select Store No.");if(!businessDate)return dsShowError("Please select Business Date.");const u=dsGetCurrentUser()||{};const data={mode:dsEditId?"edit":"add",dsId:dsEditId,dailySalesNo:dsGet("dsDailySalesNo")==="Auto Generate"?"":dsGet("dsDailySalesNo"),storeNo,businessDate,totalSales:dsNum("dsTotalSales"),totalMerchandiseSales:dsNum("dsTotalMerchandiseSales"),services:dsNum("dsServices"),food:dsNum("dsFood"),beverage:dsNum("dsBeverage"),generalMerchandise:dsNum("dsGeneralMerchandise"),tobacco:dsNum("dsTobacco"),supply:dsNum("dsSupply"),foodService:dsNum("dsFoodService"),alcoholic:dsNum("dsAlcoholic"),totalCustomer:dsNum("dsTotalCustomer")};const b=document.getElementById("dsSaveButton");if(b){b.disabled=true;b.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...'}try{const r=await callAPI("saveDailySales",{username:u.username||"",data});if(!r?.status)return dsShowError(r?.message||"Unable to save Daily Sales.");dsShowSuccess(r.message||"Daily Sales saved successfully.");dsCloseForm();await dsLoad()}catch(e){console.error(e);dsShowError("Unable to connect to the server.")}finally{if(b){b.disabled=false;b.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save Daily Sales'}}}
function dsCalculate(){const sales=dsNum("dsTotalSales"),cust=dsNum("dsTotalCustomer"),budget=dsNum("dsBudgetSales");dsSet("dsTransactionSize",(cust>0?sales/cust:0).toFixed(2));dsSet("dsPercentage",(budget>0?sales/budget*100:0).toFixed(2)+"%")}
function dsNum(id){const n=Number(dsGet(id).replace(/,/g,"").replace(/[^\d.-]/g,""));return Number.isFinite(n)?n:0}
function dsMoney(v){const n=Number(String(v||"").replace(/,/g,"").replace(/[^\d.-]/g,""));return Number.isFinite(n)?n.toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2}):""}
function dsToInputDate(v){const m=String(v||"").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:String(v||"")}
function dsRenderTable(){const b=document.getElementById("dsTableBody"),c=document.getElementById("dsCount");if(!b)return;const q=dsGet("dsSearch").toLowerCase(),rows=dsRows.filter(r=>[r.dsId,r.dailySalesNo,r.storeNo,r.storeName,r.businessDate,r.personInCharge].join(" ").toLowerCase().includes(q));if(c)c.textContent=`${rows.length} Record${rows.length===1?"":"s"}`;if(!rows.length){b.innerHTML='<tr><td colspan="9" class="ds-empty">No Daily Sales records found.</td></tr>';return}b.innerHTML=rows.map(r=>`<tr><td>${dsEsc(r.dailySalesNo)}</td><td>${dsEsc(r.businessDate)}</td><td>${dsEsc(r.storeNo)}</td><td>${dsEsc(r.storeName)}</td><td class="ds-number">${dsMoney(r.totalSales)}</td><td class="ds-number">${dsMoney(r.budgetSales)}</td><td class="ds-number">${dsEsc(r.totalCustomer)}</td><td class="ds-number">${dsEsc(r.transactionSize)}</td><td><button class="ds-edit-btn" type="button" onclick="dsOpenEdit('${dsAttr(r.dsId)}')"><i class="fa-solid fa-pen"></i> Edit</button></td></tr>`).join("")}
function dsEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function dsAttr(v){return String(v??"").replace(/'/g,"\\'")}
function dsShowSuccess(m){if(typeof showSuccess==="function")return showSuccess(m);if(typeof Swal!=="undefined")return Swal.fire({icon:"success",title:"SUCCESS",text:m,confirmButtonColor:"#198754"});alert(m)}
function dsShowError(m){if(typeof showError==="function")return showError(m);if(typeof Swal!=="undefined")return Swal.fire({icon:"error",title:"VALIDATION",text:m,confirmButtonColor:"#dc3545"});alert(m)}
document.addEventListener("input",e=>{if(e.target?.id==="dsSearch")dsRenderTable();if(["dsTotalSales","dsTotalCustomer"].includes(e.target?.id))dsCalculate()});document.addEventListener("change",e=>{if(e.target?.id==="dsStoreNo")dsStoreChanged()});


/* ==========================================
   DAILY SALES UI COMPATIBILITY ALIASES
   Keep HTML button handlers and JS functions aligned.
========================================== */

function onDailySalesStoreChange(){
    if(typeof dsStoreChanged === "function") dsStoreChanged();
}

function openDailySalesForm(){
    if(typeof dsOpenAdd === "function") dsOpenAdd();
    else if(typeof dsToggleForm === "function") dsToggleForm(true);
}

function closeDailySalesForm(){
    if(typeof dsCloseForm === "function") dsCloseForm();
}

function saveDailySales(){
    if(typeof dsSave === "function") return dsSave();
}

function filterDailySalesTable(){
    if(typeof dsRenderTable === "function") dsRenderTable();
}

function editDailySales(id){
    if(typeof dsOpenEdit === "function") dsOpenEdit(id);
}

function calculateDailySales(){
    if(typeof dsCalculate === "function") dsCalculate();
}

