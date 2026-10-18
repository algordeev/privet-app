import {PRODUCT} from './config';
import {comparisonFairNote,comparisonRows} from './comparison';

export function ComparisonTable({id}:{id?:string}){
 return <div className="comparison">
  <table className="comparison-table" aria-describedby={id?`${id}-note`:undefined}>
   <caption className="visually-hidden">{PRODUCT.name} compared with Duolingo</caption>
   <thead><tr><th scope="col">Feature</th><th scope="col" className="comparison-privet">{PRODUCT.name}</th><th scope="col">Duolingo</th></tr></thead>
   <tbody>{comparisonRows.map(row=><tr key={row.id}>
    <th scope="row">{row.feature}</th>
    <td className="comparison-privet" data-label={PRODUCT.name}><span className="comparison-mark" aria-hidden="true">✓</span>{row.privet}</td>
    <td data-label="Duolingo">{row.duolingo}</td>
   </tr>)}</tbody>
  </table>
  <p className="comparison-note" id={id?`${id}-note`:undefined}><span aria-hidden="true">↳</span> {comparisonFairNote}</p>
 </div>;
}
