import { Loader2 } from "lucide-react"

interface LoadingModalProps {
  text?: string
}

export function LoadingModal({ text = "Loading..." }: LoadingModalProps) {
  return (
    <div className="absolute inset-0 bg-slate-700/40   opacity-80 ">
      <div className="absolute left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full flex justify-center items-center flex-row">
        <div className="absolute flex-row items-center gap-2 justify-center flex">
          <Loader2 className="h-8 w-8 animate-spin text-primary"/>
          <p className="text-sm text-white w-full text-center">{text}</p>
        </div>
      </div>
    </div>
  )
} 