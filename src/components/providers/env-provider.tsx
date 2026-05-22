'use client'

import * as React from 'react'

type EnvType = 'DEV' | 'OPS'

interface EnvContextType {
  env: EnvType
  setEnv: (env: EnvType) => void
  clusterIp: string
}

const EnvContext = React.createContext<EnvContextType | undefined>(undefined)

export function EnvProvider({ children, initialEnv = 'DEV' }: { children: React.ReactNode, initialEnv?: EnvType }) {
  const [env, setEnvState] = React.useState<EnvType>(initialEnv)
  
  const clusterIp = env === 'DEV' ? '10.70.171.187' : '0.0.0.0'

  // 초기 로드 시 쿠키에서 환경 설정 읽기
  React.useEffect(() => {
    const savedEnv = document.cookie
      .split('; ')
      .find(row => row.startsWith('TARGET_ENV='))
      ?.split('=')[1] as EnvType | undefined

    if (savedEnv && (savedEnv === 'DEV' || savedEnv === 'OPS')) {
      setEnvState(savedEnv)
    }
  }, [])

  const setEnv = (newEnv: EnvType) => {
    setEnvState(newEnv)
    document.cookie = `TARGET_ENV=${newEnv}; path=/; max-age=31536000`
    // 페이지를 새로고침하여 서버 컴포넌트 환경 변수 동기화
    window.location.reload()
  }

  return (
    <EnvContext.Provider value={{ env, setEnv, clusterIp }}>
      {children}
    </EnvContext.Provider>
  )
}

export function useEnv() {
  const context = React.useContext(EnvContext)
  if (context === undefined) {
    throw new Error('useEnv must be used within an EnvProvider')
  }
  return context
}
