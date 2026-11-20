// The header of an app subpage: a back chevron, a centred title (focused on arrival) and a spacer for balance.
export function SubpageHeader({title,titleId,backLabel,onBack}:{title:string;titleId:string;backLabel:string;onBack:()=>void}){
 return <header className="native-profile-navigation">
  <button className="app-icon-button" onClick={onBack} aria-label={backLabel}>
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>
  </button>
  <h1 id={titleId} tabIndex={-1}>{title}</h1>
  <span aria-hidden="true"/>
 </header>;
}
