import { Navigate, useParams } from 'react-router-dom'
import Section1 from '../components/form/sections/Section1'
import Section2 from '../components/form/sections/Section2'
import Section3 from '../components/form/sections/Section3'
import Section4 from '../components/form/sections/Section4'
import Section5 from '../components/form/sections/Section5'
import Section6 from '../components/form/sections/Section6'
import Section7 from '../components/form/sections/Section7'
import Section8 from '../components/form/sections/Section8'
import Section9 from '../components/form/sections/Section9'
import Section10 from '../components/form/sections/Section10'
import Section11 from '../components/form/sections/Section11'
import Section12 from '../components/form/sections/Section12'
import Section13 from '../components/form/sections/Section13'
import Section14 from '../components/form/sections/Section14'
import Section15 from '../components/form/sections/Section15'
import Section16 from '../components/form/sections/Section16'
import Section17 from '../components/form/sections/Section17'
import Section18 from '../components/form/sections/Section18'
import Section19 from '../components/form/sections/Section19'

export default function FormSection({ onDataUpdate, currentData }) {
  const { sectionId } = useParams()
  const sectionNumber = parseInt(sectionId) || 1

  const handleUpdate = (updates) => {
    if (onDataUpdate) {
      onDataUpdate(updates)
    }
  }

  const renderSection = () => {
    switch (sectionNumber) {
      case 1:
        return <Section1 data={currentData?.section1 || {}} onUpdate={handleUpdate} />
      case 2:
        return <Section2 data={currentData?.section2 || {}} onUpdate={handleUpdate} />
      case 3:
        return <Section3 data={currentData?.section3 || {}} onUpdate={handleUpdate} />
      case 4:
        return <Section4 data={currentData?.section4 || {}} onUpdate={handleUpdate} />
      case 5:
        return <Section5 data={currentData?.section5 || {}} onUpdate={handleUpdate} />
      case 6:
        return <Section6 data={currentData?.section6 || {}} onUpdate={handleUpdate} />
      case 7:
        return <Section7 data={currentData?.section7 || {}} onUpdate={handleUpdate} />
      case 8:
        return <Section8 data={currentData?.section8 || {}} onUpdate={handleUpdate} />
      case 9:
        return <Section9 data={currentData?.section9 || {}} onUpdate={handleUpdate} />
      case 10:
        return <Section10 data={currentData?.section10 || {}} onUpdate={handleUpdate} />
      case 11:
        return <Section11 data={currentData?.section11 || {}} onUpdate={handleUpdate} />
      case 12:
        return <Section12 data={currentData?.section12 || {}} onUpdate={handleUpdate} />
      case 13:
        return <Section13 data={currentData?.section13 || {}} onUpdate={handleUpdate} />
      case 14:
        return <Section14 data={currentData?.section14 || {}} onUpdate={handleUpdate} />
      case 15:
        return <Section15 data={currentData?.section15 || {}} onUpdate={handleUpdate} />
      case 16:
        return <Section16 data={currentData?.section16 || {}} onUpdate={handleUpdate} />
      case 17:
        return <Section17 data={currentData?.section17 || {}} onUpdate={handleUpdate} />
      case 18:
        return <Section18 data={currentData?.section18 || {}} onUpdate={handleUpdate} />
      case 19:
        return <Section19 data={currentData?.section19 || {}} onUpdate={handleUpdate} />
      default:
        return <Navigate to="/application/form/section/1" replace />
    }
  }

  return renderSection()
}
