/* =========================================================
   STORE APPS — MANAGEMENT SALES DASHBOARD
   ADDITIVE ONLY
   Data source: existing Daily Sales API -> Daily Sales1
   ========================================================= */

let mgmtSalesDate = "";
let mgmtInitialized = false;

function mgmtCurrentUser(){
    try{
        if(typeof getCurrentUser === "function") return getCurrentUser() || {};
    }catch(e){}
    try{
        return JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    }catch(e){ return {}; }
}

function mgmtYesterdayISO(){
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function mgmtAddDays(iso, amount){
    const p = String(iso||"").split("-").map(Number);
    if(p.length !== 3 || p.some(Number.isNaN)) return "";
    const d = new Date(p[0],p[1]-1,p[2]);
    d.setDate(d.getDate()+amount);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function mgmtDatesBetween(startISO,endISO){
    const out=[];
    let cursor=startISO;
    let guard=0;
    while(cursor && cursor <= endISO && guard < 370){
        out.push(cursor);
        cursor=mgmtAddDays(cursor,1);
        guard++;
    }
    return out;
}

function mgmtMonthStart(iso){
    const p=String(iso||"").split("-").map(Number);
    if(p.length!==3 || p.some(Number.isNaN)) return "";
    return `${p[0]}-${String(p[1]).padStart(2,"0")}-01`;
}

function mgmtDaysInMonth(iso){
    const p=String(iso||"").split("-").map(Number);
    if(p.length!==3 || p.some(Number.isNaN)) return 0;
    return new Date(p[0],p[1],0).getDate();
}

function mgmtMoney(value){
    const n=Number(String(value??"").replace(/,/g,""))||0;
    return "RM " + Math.round(n).toLocaleString("en-MY",{maximumFractionDigits:0});
}

function mgmtNumber(value){
    return (Number(value)||0).toLocaleString("en-MY",{maximumFractionDigits:0});
}

function mgmtPercent(value){
    return `${(Number(value)||0).toFixed(2)}%`;
}

function mgmtDisplayDate(iso){
    const p=String(iso||"").split("-");
    if(p.length!==3) return iso || "—";
    return `${p[2]}/${p[1]}/${p[0]}`;
}

function mgmtSetText(id,value){
    const el=document.getElementById(id);
    if(el) el.textContent=value;
}

function mgmtSetVariance(id,pctId,variance,budget){
    const el=document.getElementById(id);
    const pctEl=document.getElementById(pctId);
    const pct=budget!==0 ? (variance/budget)*100 : (variance>0 ? 100 : 0);
    const cls=variance>0.004 ? "mgmt-positive" : variance<-0.004 ? "mgmt-negative" : "mgmt-neutral";
    if(el){
        el.className="mgmt-variance "+cls;
        el.textContent=(variance>=0?"+":"")+mgmtMoney(variance);
    }
    if(pctEl){
        pctEl.className="mgmt-percent "+cls;
        pctEl.textContent=(pct>=0?"+":"")+mgmtPercent(pct)+" variance";
    }
}

function mgmtSetChange(id,pct){
    const el=document.getElementById(id);
    if(!el) return;
    const n=Number(pct)||0;
    const cls=n>0.004 ? "mgmt-positive" : n<-0.004 ? "mgmt-negative" : "mgmt-neutral";
    el.className="mgmt-week-change "+cls;
    el.textContent=(n>=0?"+":"")+mgmtPercent(n);
}

function mgmtStoreKey(v){
    return String(v||"").replace(/^#/,'').trim().toLowerCase();
}

function mgmtRowSales(row){
    return Number(String(row?.totalMerchandiseSales ?? "").replace(/,/g,""))||0;
}

function mgmtRowCustomer(row){
    return Number(String(row?.totalCustomer ?? "").replace(/,/g,""))||0;
}

function mgmtStoreBudget(store){
    return Number(String(store?.budgetSales ?? "").replace(/,/g,""))||0;
}

function mgmtOpeningISO(store){
    const raw=String(store?.openingDate||"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(m) return `${m[3]}-${m[2]}-${m[1]}`;
    return "";
}

function mgmtActiveStoreDays(store, startISO, endISO){
    const opening=mgmtOpeningISO(store);
    const start=opening && opening>startISO ? opening : startISO;
    if(!start || start>endISO) return 0;
    return mgmtDatesBetween(start,endISO).length;
}

async function mgmtFetchDateResponses(dates,username,role){
    return Promise.all(dates.map(date =>
        callDailySalesAPI("getDailySalesList",{username,role,date})
    ));
}

function mgmtAggregate(responses){
    let sales=0;
    let customer=0;
    const storeDays=new Set();
    const dataDays=new Set();

    (Array.isArray(responses)?responses:[]).forEach((response,index)=>{
        if(!response?.status || !Array.isArray(response.rows)) return;
        const rows=response.rows;
        if(rows.length) dataDays.add(index);
        rows.forEach(row=>{
            const key=mgmtStoreKey(row.storeNo);
            if(key) storeDays.add(index+"|"+key);
            sales += mgmtRowSales(row);
            customer += mgmtRowCustomer(row);
        });
    });

    return {sales,customer,storeDays:storeDays.size,dataDays:dataDays.size};
}

async function loadManagementSalesDashboard(dateOverride=""){
    const user=mgmtCurrentUser();
    if(!user?.username) return;
    if(typeof callDailySalesAPI !== "function"){
        mgmtShowError("Daily Sales API is not available.");
        return;
    }

    const selected=dateOverride || mgmtSalesDate || mgmtYesterdayISO();
    mgmtSalesDate=selected;

    const loading=document.getElementById("mgmtSalesLoading");
    const error=document.getElementById("mgmtSalesError");
    if(loading) loading.style.display="flex";
    if(error) error.style.display="none";

    const username=user.username||"";
    const role=user.role||"";

    try{
        const storesResponse=await callDailySalesAPI("getDailySalesStores",{username,role});
        if(!storesResponse?.status) throw new Error(storesResponse?.message||"Unable to load store budget data.");

        const stores=Array.isArray(storesResponse.stores)?storesResponse.stores:[];
        const monthStart=mgmtMonthStart(selected);
        const monthDates=mgmtDatesBetween(monthStart,selected);
        const currentWeekStart=mgmtAddDays(selected,-6);
        const previousWeekEnd=mgmtAddDays(selected,-7);
        const previousWeekStart=mgmtAddDays(selected,-13);

        const [mtdResponses,currentWeekResponses,previousWeekResponses]=await Promise.all([
            mgmtFetchDateResponses(monthDates,username,role),
            mgmtFetchDateResponses(mgmtDatesBetween(currentWeekStart,selected),username,role),
            mgmtFetchDateResponses(mgmtDatesBetween(previousWeekStart,previousWeekEnd),username,role)
        ]);

        const mtd=mgmtAggregate(mtdResponses);
        const currentWeek=mgmtAggregate(currentWeekResponses);
        const previousWeek=mgmtAggregate(previousWeekResponses);

        /*
         * Budget is the existing store budget from Daily Sales/Area.
         * Monthly = daily budget x calendar days in selected month.
         * MTD budget respects each store's opening date.
         */
        let totalDailyBudget=0;
        let totalMonthlyBudget=0;
        let mtdBudget=0;
        let mtdActiveStoreDays=0;

        stores.forEach(store=>{
            const budget=mgmtStoreBudget(store);
            totalDailyBudget += budget;
            totalMonthlyBudget += budget * mgmtDaysInMonth(selected);
            const activeDays=mgmtActiveStoreDays(store,monthStart,selected);
            mtdBudget += budget * activeDays;
            mtdActiveStoreDays += activeDays;
        });

        const apsdBudget=mtdActiveStoreDays ? mtdBudget/mtdActiveStoreDays : 0;
        const apsdSales=mtdActiveStoreDays ? mtd.sales/mtdActiveStoreDays : 0;
        const apsdVariance=apsdSales-apsdBudget;
        const mtdVariance=mtd.sales-mtdBudget;

        /* Weekly APSD uses actual submitted store-days, not a fixed 7-day denominator. */
        const currentApsdSales=currentWeek.storeDays ? currentWeek.sales/currentWeek.storeDays : 0;
        const previousApsdSales=previousWeek.storeDays ? previousWeek.sales/previousWeek.storeDays : 0;
        const currentApsdCustomer=currentWeek.storeDays ? currentWeek.customer/currentWeek.storeDays : 0;
        const previousApsdCustomer=previousWeek.storeDays ? previousWeek.customer/previousWeek.storeDays : 0;

        const weeklySalesPct=previousApsdSales!==0 ? ((currentApsdSales-previousApsdSales)/Math.abs(previousApsdSales))*100 : (currentApsdSales>0?100:0);
        const weeklyCustomerPct=previousApsdCustomer!==0 ? ((currentApsdCustomer-previousApsdCustomer)/Math.abs(previousApsdCustomer))*100 : (currentApsdCustomer>0?100:0);

        mgmtSetText("mgmtSalesPeriod",`Through ${mgmtDisplayDate(selected)}`);
        mgmtSetText("mgmtTotalBudget",mgmtMoney(totalMonthlyBudget));
        mgmtSetText("mgmtTotalBudgetNote",`${mgmtDaysInMonth(selected)} days × ${mgmtMoney(totalDailyBudget)} daily store budget`);

        mgmtSetText("mgmtApsdBudget",mgmtMoney(apsdBudget));
        mgmtSetText("mgmtApsdSales",mgmtMoney(apsdSales));
        mgmtSetVariance("mgmtApsdVariance","mgmtApsdVariancePct",apsdVariance,apsdBudget);

        mgmtSetText("mgmtBudgetMtd",mgmtMoney(mtdBudget));
        mgmtSetText("mgmtSalesMtd",mgmtMoney(mtd.sales));
        mgmtSetVariance("mgmtMtdVariance","mgmtMtdVariancePct",mtdVariance,mtdBudget);

        mgmtSetText("mgmtWeeklySales",mgmtMoney(currentApsdSales));
        mgmtSetText("mgmtWeeklySalesPrev",`vs ${mgmtMoney(previousApsdSales)} last week`);
        mgmtSetChange("mgmtWeeklySalesPct",weeklySalesPct);

        mgmtSetText("mgmtWeeklyCustomer",mgmtNumber(currentApsdCustomer));
        mgmtSetText("mgmtWeeklyCustomerPrev",`vs ${mgmtNumber(previousApsdCustomer)} last week`);
        mgmtSetChange("mgmtWeeklyCustomerPct",weeklyCustomerPct);

        mgmtSetText("mgmtWeeklyCurrentPeriod",`${mgmtDisplayDate(currentWeekStart)} – ${mgmtDisplayDate(selected)}`);
        mgmtSetText("mgmtWeeklyPreviousPeriod",`${mgmtDisplayDate(previousWeekStart)} – ${mgmtDisplayDate(previousWeekEnd)}`);

    }catch(errorObj){
        console.error(errorObj);
        mgmtShowError(errorObj?.message||"Unable to load Management Sales Dashboard.");
    }finally{
        if(loading) loading.style.display="none";
    }
}

function mgmtShowError(message){
    const el=document.getElementById("mgmtSalesError");
    if(!el) return;
    el.textContent=message;
    el.style.display="block";
}

function initManagementDashboard(){
    const user=mgmtCurrentUser();
    if(!user?.username) return;

    const input=document.getElementById("mgmtSalesDate");
    const calendarIcon=document.getElementById("mgmtSalesDateIcon");
    if(input && !mgmtInitialized){
        mgmtInitialized=true;
        input.value=mgmtSalesDate||mgmtYesterdayISO();
        input.addEventListener("change",()=>{
            mgmtSalesDate=input.value||mgmtYesterdayISO();
            loadManagementSalesDashboard(mgmtSalesDate);
        });

        /* Calendar icon opens the native date picker without changing
           the existing read-only Business Date behaviour. */
        const openPicker=()=>{
            try{
                if(typeof input.showPicker === "function"){
                    input.showPicker();
                    return;
                }
            }catch(e){}
            try{
                input.removeAttribute("readonly");
                input.focus();
                input.click();
                setTimeout(()=>input.setAttribute("readonly","readonly"),250);
            }catch(e){}
        };

        if(calendarIcon){
            calendarIcon.addEventListener("click",openPicker);
            calendarIcon.addEventListener("keydown",(event)=>{
                if(event.key === "Enter" || event.key === " "){
                    event.preventDefault();
                    openPicker();
                }
            });
        }
    }

    const selected=(input?.value)||mgmtSalesDate||mgmtYesterdayISO();
    mgmtSalesDate=selected;
    loadManagementSalesDashboard(selected);
}

window.initManagementDashboard=initManagementDashboard;
window.loadManagementSalesDashboard=loadManagementSalesDashboard;
