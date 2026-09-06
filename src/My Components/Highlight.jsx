import { RiDeleteBin6Line } from "react-icons/ri";


export const Highlight = ({ highlights, bookId, onDeleteHighlight, onRemoveHighlightFromPdf, onGoToPage }) => {

  const darkerShade = (hex, amount = 95) => {
    const num = parseInt(hex.replace("#", ""), 16)

    const r = Math.max(0, (num >> 16) - amount)
    const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
    const b = Math.max(0, (num & 0x0000FF) - amount);

    return `rgb(${r}, ${g}, ${b})`;
  }

  const deleteHighlight = async(highlightId) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`http://localhost:5000/api/books/${bookId}/highlights/${highlightId}`, {
        method: "DELETE",
        headers: {Authorization: `Bearer ${token}`}
      })
      const data = await response.json();
  
      if(!response.ok) {
        throw new Error(data.message)
      }
      console.log(data.message)
      onDeleteHighlight(highlightId);
      onRemoveHighlightFromPdf(highlightId);
    }
    catch (error) {
      console.log("Error deleting highlight!", error)
    }

  }


  return (
    <div className=' h-[74vh] flex flex-col overflow-hidden'>
      <div className='overflow-y-auto'>
        <div className="flex flex-col gap-3">
          {highlights.length === 0 ? (<p className="text-gray-400">No highlights yet.</p>) : (highlights.map((highlight) => (
              <div key={highlight._id} className="p-3 relative group rounded-lg cursor-default border-l-7 " style={{backgroundColor: highlight.color,borderColor: darkerShade(highlight.color, 95)}}>
                <div className="p-2 rounded hover:opacity-80 transition-opacity cursor-pointer leading-6 font-lora" onClick={()=>onGoToPage(highlight.pageNumber)} style={{backgroundColor: highlight.color, color: "#000"}}>
                  {highlight.text}
                </div>
                <p className="text-xs text-gray-500 mt-2 font-inter">Page {highlight.pageNumber}</p>
                <RiDeleteBin6Line onClick={(e) => { e.stopPropagation(); deleteHighlight(highlight._id) }} className=" absolute bottom-2 right-4 opacity-0 group-hover:opacity-100 text-lg text-gray-500 hover:text-red-400 cursor-pointer transition " />
                
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Highlight
