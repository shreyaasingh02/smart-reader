import React from "react";
import { RiDeleteBin6Line } from "react-icons/ri";

export const Notes = ({ notes, onDeleteNote, onGoToPage }) => {

  return (
    <div className="h-[74vh] flex flex-col overflow-hidden font-inter">

      <div className="overflow-y-auto">

        <div className="flex flex-col gap-3">

          {notes.length === 0 ? ( <p className="text-gray-400"> No notes yet. </p> ) : (

            notes.map((note) => (

              <div key={note._id} className=" p-3 relative group rounded-lg cursor-default bg-[#2D2D2D] hover:opacity-80 transition-opacity " >

                <div onClick={() => onGoToPage(note.pageNumber)} className=" p-2 rounded-lg bg-[#3A3A3A] text-[#E6E6E6] text-[14px] leading-relaxed cursor-pointer hover:bg-[#444] transition " >
                  {note.selectedText || note.anchor?.text}
                </div>

                <p className=" text-gray-200 text-[14px] mt-3 leading-relaxed pr-6 "> {note.text} </p>

                <p className=" text-[12px] text-gray-500 mt-2 "> Page {note.pageNumber} </p>

                <RiDeleteBin6Line className=" absolute bottom-2 right-4 opacity-0 group-hover:opacity-100 text-lg text-gray-500 hover:text-red-400 cursor-pointer transition "
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note._id);
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notes;