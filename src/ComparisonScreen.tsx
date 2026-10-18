import {PRODUCT} from './config';
import {ComparisonTable} from './ComparisonTable';

export function ComparisonScreen({onClose}:{onClose:()=>void}){
 return <div className="native-profile-scroll native-compare-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label="Back to home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-compare-title" tabIndex={-1}>Why {PRODUCT.name}?</h1><span aria-hidden="true"/></header>
  <section className="native-compare-intro"><h2>{PRODUCT.name} vs Duolingo</h2><p>What you get here that Duolingo doesn’t offer.</p></section>
  <ComparisonTable id="native-compare"/>
 </div>;
}
