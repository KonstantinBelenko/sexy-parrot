/* eslint-disable */
'use client'

import { FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Glossary from './Glossary'

interface MobileGlossaryProps {
  isOpen: boolean
  onClose: () => void
  refreshTrigger?: number
}

const MobileGlossary: FC<MobileGlossaryProps> = ({ isOpen, onClose, refreshTrigger = 0 }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={onClose}
          />

          {/* slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-80 bg-background border-l z-50 lg:hidden"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-medium">Glossary</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <Glossary refreshTrigger={refreshTrigger} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default MobileGlossary 