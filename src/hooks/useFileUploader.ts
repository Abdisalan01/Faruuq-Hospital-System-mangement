import { useState } from 'react'

import type { UploadFileType } from '@/types/component-props'
import { formatFileSize } from '@/utils/other'

export default function useFileUploader(showPreview: boolean = true) {
  const [selectedFiles, setSelectedFiles] = useState<UploadFileType[]>([])

  const handleAcceptedFiles = (files: UploadFileType[], callback?: (files: UploadFileType[]) => void) => {
    let allFiles: UploadFileType[] = []

    if (showPreview) {
      files = files.map((file) => {
        return {
          ...file,
          preview: file['type']?.split('/')[0] === 'image' ? URL.createObjectURL(file) : undefined,
          formattedSize: formatFileSize(file.size),
        }
      })

      allFiles = [...selectedFiles, ...files]
      setSelectedFiles(allFiles)
    }

    if (callback) callback(allFiles)
  }

  const removeFile = (file: UploadFileType) => {
    const newFiles = [...selectedFiles]
    newFiles?.splice(newFiles.indexOf(file), 1)
    setSelectedFiles(newFiles)
  }

  return {
    selectedFiles,
    handleAcceptedFiles,
    removeFile,
  }
}
