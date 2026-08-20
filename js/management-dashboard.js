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
    return Math.round(n).toLocaleString("en-MY",{maximumFractionDigits:0});
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
        el.textContent=(variance>=0?"+":"")+mgmtNumber(variance);
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
    const cls=n>0.004 ? "mgmt-week-positive" : n<-0.004 ? "mgmt-week-negative" : "mgmt-week-neutral";
    el.className="mgmt-week-change "+cls;
    el.textContent=(n>=0?"▲ ":"▼ ")+mgmtPercent(Math.abs(n));
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


function mgmtStoreSeries(responses){
    const map={};
    (Array.isArray(responses)?responses:[]).forEach((response,index)=>{
        if(!response?.status || !Array.isArray(response.rows)) return;
        response.rows.forEach(row=>{
            const key=mgmtStoreKey(row.storeNo);
            if(!key) return;
            if(!map[key]) map[key]={storeNo:row.storeNo,storeName:row.storeName||"",sales:0,customer:0,days:0};
            map[key].sales += mgmtRowSales(row);
            map[key].customer += mgmtRowCustomer(row);
            map[key].days += 1;
        });
    });
    return map;
}

function mgmtRenderSalesInsights(stores,mtdResponses,currentWeekResponses,previousWeekResponses,selected){
    const dropsEl=document.getElementById("mgmtInsightDrops");
    const oppEl=document.getElementById("mgmtInsightOpportunities");
    const actionEl=document.getElementById("mgmtInsightActions");
    if(!dropsEl || !oppEl || !actionEl) return;

    const mtd=mgmtStoreSeries(mtdResponses);
    const current=mgmtStoreSeries(currentWeekResponses);
    const previous=mgmtStoreSeries(previousWeekResponses);
    const storeMap={};
    (Array.isArray(stores)?stores:[]).forEach(store=>{
        const key=mgmtStoreKey(store.storeNo);
        if(key) storeMap[key]=store;
    });

    const drops=Object.keys(current).map(key=>{
        const cur=current[key], prev=previous[key];
        if(!prev || !prev.days || !cur.days) return null;
        const curApsd=cur.sales/cur.days;
        const prevApsd=prev.sales/prev.days;
        const pct=prevApsd ? ((curApsd-prevApsd)/Math.abs(prevApsd))*100 : 0;
        return {...cur,pct,curApsd,prevApsd};
    }).filter(x=>x && x.pct<0).sort((a,b)=>a.pct-b.pct).slice(0,3);

    const opportunities=Object.keys(mtd).map(key=>{
        const item=mtd[key], store=storeMap[key]||{};
        const budget=mgmtStoreBudget(store);
        const opening=mgmtOpeningISO(store);
        const monthStart=mgmtMonthStart(selected);
        const activeStart=opening && opening>monthStart ? opening : monthStart;
        const activeDays=activeStart && activeStart<=selected ? mgmtDatesBetween(activeStart,selected).length : 0;
        const budgetMtd=budget*activeDays;
        const gapPct=budgetMtd ? ((item.sales-budgetMtd)/budgetMtd)*100 : 0;
        const actualPct=budgetMtd ? (item.sales/budgetMtd)*100 : 0;
        if(!budgetMtd || item.sales<=0) return null;
        return {...item,storeName:store.storeName||item.storeName,budgetMtd,gapPct,actualPct};
    }).filter(Boolean).sort((a,b)=>a.gapPct-b.gapPct).slice(0,3);

    if(!drops.length){
        dropsEl.innerHTML='<div class="mgmt-insight-empty"><i class="fa-solid fa-circle-check"></i> No significant weekly sales drop detected.</div>';
    }else{
        dropsEl.innerHTML=drops.map(item=>`<div class="mgmt-insight-row"><div><strong>#${mgmtStoreKey(item.storeNo)}</strong><span>${mgmtEscape(item.storeName)}</span></div><b class="mgmt-insight-negative">▼ ${Math.abs(item.pct).toFixed(2)}%</b><small>${mgmtMoney(item.curApsd)} vs ${mgmtMoney(item.prevApsd)}</small></div>`).join('');
    }

    if(!opportunities.length){
        oppEl.innerHTML='<div class="mgmt-insight-empty"><i class="fa-solid fa-circle-check"></i> No major sales gap detected.</div>';
    }else{
        oppEl.innerHTML=opportunities.map(item=>`<div class="mgmt-insight-row"><div><strong>#${mgmtStoreKey(item.storeNo)}</strong><span>${mgmtEscape(item.storeName)}</span></div><b class="mgmt-insight-negative">${item.gapPct.toFixed(2)}%</b><small>${mgmtMoney(item.sales)} sales vs ${mgmtMoney(item.budgetMtd)} budget</small></div>`).join('');
    }

    const actions=[];
    if(drops[0]) actions.push(`Prioritise <strong>#${mgmtStoreKey(drops[0].storeNo)}</strong> and review the sales drivers behind the ${Math.abs(drops[0].pct).toFixed(2)}% weekly drop.`);
    if(opportunities[0]) actions.push(`Focus on <strong>#${mgmtStoreKey(opportunities[0].storeNo)}</strong> to close its MTD budget gap of ${Math.abs(opportunities[0].gapPct).toFixed(2)}%.`);
    actions.push('Compare customer traffic, basket size and daily trading pattern before setting the store action plan.');
    actionEl.innerHTML=actions.slice(0,3).map((text,i)=>`<div class="mgmt-action-item"><i class="fa-solid fa-${i===0?'bullseye':i===1?'arrow-up':'list-check'}"></i><span>${text}</span></div>`).join('');
}

function mgmtEscape(value){
    return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
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
        /* APSD Sales uses actual submitted store-days so missing Daily Sales
         * records do not artificially lower the daily sales average. */
        const apsdSales=mtd.storeDays ? mtd.sales/mtd.storeDays : 0;
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

        mgmtRenderSalesInsights(stores,mtdResponses,currentWeekResponses,previousWeekResponses,selected);

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
    const displayInput=document.getElementById("mgmtSalesDateDisplay");
    const calendarIcon=document.getElementById("mgmtSalesDateIcon");

    const syncDisplayDate=()=>{
        if(displayInput){
            displayInput.value=mgmtDisplayDate(input?.value||mgmtSalesDate||mgmtYesterdayISO());
        }
    };

    if(input && !mgmtInitialized){
        mgmtInitialized=true;
        input.value=mgmtSalesDate||mgmtYesterdayISO();
        syncDisplayDate();

        input.addEventListener("change",()=>{
            mgmtSalesDate=input.value||mgmtYesterdayISO();
            syncDisplayDate();
            loadManagementSalesDashboard(mgmtSalesDate);
        });

        /* Visible Business Date is read-only. The hidden native date input
           is the actual picker target, so the calendar icon always opens it. */
        const openPicker=()=>{
            try{
                input.focus({preventScroll:true});
                if(typeof input.showPicker === "function"){
                    input.showPicker();
                    return;
                }
                input.click();
            }catch(e){
                try{ input.click(); }catch(ignore){}
            }
        };

        if(calendarIcon){
            calendarIcon.addEventListener("click",openPicker);
        }
        if(displayInput){
            displayInput.addEventListener("click",openPicker);
        }
    }

    const selected=(input?.value)||mgmtSalesDate||mgmtYesterdayISO();
    mgmtSalesDate=selected;
    syncDisplayDate();
    loadManagementSalesDashboard(selected);
}

window.initManagementDashboard=initManagementDashboard;
window.loadManagementSalesDashboard=loadManagementSalesDashboard;
