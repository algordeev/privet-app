// Gems are earned only by learning and spent on heart refills and streak freezes.
// The rules are fixed and the same for everyone.
export const GEM_RULES={finish:5,perfect:5,streakWeek:10,refill:20,freeze:30,maxFreezes:2} as const;
export type GemBreakdown={finish:number;perfect:number;streakWeek:number};

// balance and freezes held; per day, the lessons that earned their finish gems (awarded) and
// what each earned in total (awards); the days that earned the weekly streak bonus (milestones).
export type GemWallet={balance:number;freezes:number;awarded:Record<string,string[]>;milestones:string[];awards:Record<string,Record<string,GemBreakdown>>};
export function emptyWallet():GemWallet{return {balance:0,freezes:0,awarded:{},milestones:[],awards:{}};}

// Takes gems out; null if the amount is not a whole, non-negative number the balance covers.
export function spend(wallet:GemWallet,amount:number):GemWallet|null{
 if(!Number.isSafeInteger(amount)||amount<0||amount>wallet.balance)return null;
 return {...wallet,balance:wallet.balance-amount};
}

// A streak freeze, if one more can be held and paid for.
export function addFreeze(wallet:GemWallet):GemWallet|null{
 if(wallet.freezes>=GEM_RULES.maxFreezes)return null;
 const paid=spend(wallet,GEM_RULES.freeze);
 return paid&&{...paid,freezes:paid.freezes+1};
}

// Freezes used up covering missed days.
export function spendFreezes(wallet:GemWallet,count:number):GemWallet{return {...wallet,freezes:wallet.freezes-count};}

// The weekly bonus: each time the streak reaches a multiple of seven days, at most once that day.
export function weeklyStreakBonus(streak:number,day:string,wallet:GemWallet):number{
 return streak>0&&streak%7===0&&!wallet.milestones.includes(day)?GEM_RULES.streakWeek:0;
}
