"use client"

import { useState } from "react"
import { BrowseCreatorsTab } from "@/components/creators/browse-creators-tab"

export default function CreatorsPage() {
  return (
    <div className="container mx-auto py-5">
      <div className="flex flex-col gap-4">
        <BrowseCreatorsTab />
      </div>
    </div>
  )
}