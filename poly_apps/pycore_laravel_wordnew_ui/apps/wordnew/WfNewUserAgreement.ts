/**
 * WfNewUserAgreement — the WordNew User Agreement (Terms of Service) in every UI
 * language the app ships (en / zh / ja / ko), shown at registration behind the
 * "I agree" checkbox and reusable anywhere (About, Settings) via WfNewAgreementModal.
 *
 * This is a clean, general-purpose Terms-of-Service template built from the
 * conventional public clauses (acceptance, account, acceptable use, content
 * license, IP, privacy, third-party, disclaimers, termination, changes). It is a
 * starting point and SHOULD be reviewed by counsel before a production launch; it
 * is not legal advice. All languages share the SAME section order so the modal can
 * render any language identically.
 */

export type WfNewAgreementLang = 'en' | 'zh' | 'ja' | 'ko';

export interface WfNewAgreementSection {
  heading: string;
  body: string;
}

export interface WfNewAgreementDoc {
  title: string;
  /** Human-readable "last updated" line (absolute date). */
  updated: string;
  intro: string;
  sections: WfNewAgreementSection[];
}

const UPDATED = '2026-06-20';

export const WFNEW_USER_AGREEMENT: Record<WfNewAgreementLang, WfNewAgreementDoc> = {
  en: {
    title: 'WordNew User Agreement',
    updated: `Last updated: ${UPDATED}`,
    intro:
      'Welcome to WordNew. This User Agreement ("Agreement") governs your access to and use of the WordNew application and services ("Service"). Please read it carefully — by creating an account or using the Service you accept these terms.',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By registering for, accessing, or using the Service you agree to be bound by this Agreement. If you do not agree, do not create an account or use the Service.',
      },
      {
        heading: '2. Eligibility & Account',
        body: 'You must be old enough to enter a binding contract in your jurisdiction (and at least the minimum age required locally); minors should use the Service only with the consent of a parent or guardian. You are responsible for the credentials you choose and for all activity under your account, and you must keep your password confidential and notify us of any unauthorized use.',
      },
      {
        heading: '3. Acceptable Use',
        body: 'You agree not to misuse the Service, including: any unlawful, infringing, abusive, or harmful activity; uploading malicious code; or attempting to disrupt, reverse-engineer, scrape, or gain unauthorized access to the Service or to other users’ data.',
      },
      {
        heading: '4. Your Content & License',
        body: 'You retain ownership of the content you create or submit (such as notes, word lists, and preferences). You grant us a limited, non-exclusive license to store, process, and display that content solely to operate, secure, and improve the Service.',
      },
      {
        heading: '5. Intellectual Property',
        body: 'The Service, including its software, design, trademarks, and learning materials, is protected by intellectual-property rights and remains the property of its owners. You receive a personal, non-transferable, revocable license to use the Service for your own learning.',
      },
      {
        heading: '6. Privacy & Data',
        body: 'We collect and process only the data needed to provide the Service, such as your account details, learning progress, and preferences. We do not sell your personal data. Where a separate Privacy Policy is provided, it forms part of this Agreement.',
      },
      {
        heading: '7. Third-Party Services',
        body: 'The Service may integrate third-party features (for example, social sign-in, media, dictionaries, or AI providers). Your use of those features is also subject to the relevant third party’s terms and privacy practices, for which we are not responsible.',
      },
      {
        heading: '8. Disclaimers & Limitation of Liability',
        body: 'The Service is provided "as is" and "as available" without warranties of any kind, and learning outcomes are not guaranteed. To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.',
      },
      {
        heading: '9. Suspension & Termination',
        body: 'You may stop using the Service and delete your account at any time. We may suspend or terminate access if you violate this Agreement or to protect the Service and its users.',
      },
      {
        heading: '10. Changes & Contact',
        body: 'We may update this Agreement from time to time; we will notify you of material changes in the app, and continued use after changes take effect means you accept the updated terms. For questions about this Agreement, please use the in-app support channel.',
      },
    ],
  },

  zh: {
    title: 'WordNew 用户协议',
    updated: `最近更新：${UPDATED}`,
    intro:
      '欢迎使用 WordNew。本《用户协议》（以下简称“本协议”）规范您对 WordNew 应用及服务（以下简称“本服务”）的访问与使用。请您仔细阅读——注册账号或使用本服务即表示您接受以下条款。',
    sections: [
      {
        heading: '1. 条款的接受',
        body: '当您注册、访问或使用本服务时，即表示您同意受本协议约束。若您不同意本协议，请勿注册账号或使用本服务。',
      },
      {
        heading: '2. 资格与账号',
        body: '您须达到所在司法管辖区订立有效合同的法定年龄（且不低于当地要求的最低年龄）；未成年人应在父母或监护人同意下使用本服务。您须对所设置的账号凭证及账号下的一切活动负责，妥善保管密码，并在发现任何未经授权的使用时及时通知我们。',
      },
      {
        heading: '3. 可接受的使用',
        body: '您同意不滥用本服务，包括：任何违法、侵权、辱骂或有害的行为；上传恶意代码；或试图干扰、逆向工程、抓取本服务，或未经授权访问本服务或其他用户的数据。',
      },
      {
        heading: '4. 您的内容与授权',
        body: '您对自己创建或提交的内容（如笔记、单词表与偏好设置）保留所有权。您授予我们有限的、非排他的许可，仅为运营、保护及改进本服务之目的而存储、处理与展示该等内容。',
      },
      {
        heading: '5. 知识产权',
        body: '本服务（包括其软件、设计、商标与学习素材）受知识产权法律保护，归其权利人所有。我们仅授予您个人的、不可转让的、可撤销的许可，供您自身学习之用。',
      },
      {
        heading: '6. 隐私与数据',
        body: '我们仅收集和处理为提供本服务所必需的数据，例如您的账号信息、学习进度与偏好设置。我们不会出售您的个人数据。如另行提供《隐私政策》，则该政策构成本协议的一部分。',
      },
      {
        heading: '7. 第三方服务',
        body: '本服务可能集成第三方功能（例如社交登录、媒体、词典或 AI 服务）。您对该等功能的使用还需遵守相关第三方的条款与隐私规范，我们对此不承担责任。',
      },
      {
        heading: '8. 免责声明与责任限制',
        body: '本服务按“现状”及“现有”基础提供，不附带任何形式的保证，学习效果亦不作保证。在法律允许的最大范围内，我们对因您使用本服务而产生的任何间接、附带或后果性损害不承担责任。',
      },
      {
        heading: '9. 暂停与终止',
        body: '您可随时停止使用本服务并删除账号。若您违反本协议，或为保护本服务及其用户，我们可暂停或终止您的访问权限。',
      },
      {
        heading: '10. 变更与联系',
        body: '我们可能不时更新本协议；如有重大变更，我们将在应用内通知您，变更生效后您继续使用即视为接受更新后的条款。如对本协议有任何疑问，请通过应用内的支持渠道与我们联系。',
      },
    ],
  },

  ja: {
    title: 'WordNew 利用規約',
    updated: `最終更新日：${UPDATED}`,
    intro:
      'WordNew へようこそ。本利用規約（以下「本規約」）は、WordNew アプリケーションおよびサービス（以下「本サービス」）へのアクセスと利用に適用されます。アカウントを作成し、または本サービスを利用することで、以下の条項に同意したものとみなされますので、よくお読みください。',
    sections: [
      {
        heading: '1. 規約への同意',
        body: '本サービスに登録・アクセス・利用することにより、お客様は本規約に拘束されることに同意するものとします。同意されない場合は、アカウントを作成したり本サービスを利用したりしないでください。',
      },
      {
        heading: '2. 利用資格とアカウント',
        body: 'お客様は、ご自身の地域で有効な契約を締結できる年齢（かつ地域で定められた最低年齢以上）である必要があります。未成年者は保護者の同意のもとでのみ本サービスを利用してください。お客様は、設定した認証情報およびアカウント上のすべての活動について責任を負い、パスワードを秘密に保ち、不正利用を発見した場合は速やかにご連絡ください。',
      },
      {
        heading: '3. 許容される利用',
        body: '違法・権利侵害・虐待的・有害な行為、悪意あるコードのアップロード、本サービスの妨害・リバースエンジニアリング・スクレイピング、または本サービスや他の利用者のデータへの不正アクセスの試みなど、本サービスを濫用しないことに同意するものとします。',
      },
      {
        heading: '4. お客様のコンテンツとライセンス',
        body: 'お客様が作成・送信したコンテンツ（メモ、単語リスト、設定など）の所有権はお客様に帰属します。お客様は、本サービスの運営・保護・改善のためにのみ当該コンテンツを保存・処理・表示する限定的かつ非独占的なライセンスを当社に付与します。',
      },
      {
        heading: '5. 知的財産',
        body: '本サービス（ソフトウェア、デザイン、商標、学習素材を含む）は知的財産権により保護され、その権利者に帰属します。お客様には、ご自身の学習のために本サービスを利用する個人的・譲渡不能・取消可能なライセンスが付与されます。',
      },
      {
        heading: '6. プライバシーとデータ',
        body: '当社は、アカウント情報、学習の進捗、設定など、本サービスの提供に必要なデータのみを収集・処理します。お客様の個人データを販売することはありません。別途プライバシーポリシーが提供される場合、それは本規約の一部を構成します。',
      },
      {
        heading: '7. 第三者サービス',
        body: '本サービスは第三者の機能（ソーシャルログイン、メディア、辞書、AI プロバイダーなど）を統合することがあります。これらの機能の利用には、当該第三者の規約およびプライバシー慣行も適用され、当社は責任を負いません。',
      },
      {
        heading: '8. 免責事項と責任の制限',
        body: '本サービスは「現状有姿」かつ「提供可能な範囲」で提供され、いかなる種類の保証も伴わず、学習成果も保証されません。法律で認められる最大限の範囲で、当社はお客様の本サービス利用に起因する間接的・付随的・結果的損害について責任を負いません。',
      },
      {
        heading: '9. 利用停止と終了',
        body: 'お客様はいつでも本サービスの利用を停止し、アカウントを削除できます。お客様が本規約に違反した場合、または本サービスとその利用者を保護するために、当社はアクセスを停止または終了することがあります。',
      },
      {
        heading: '10. 変更と連絡',
        body: '当社は本規約を随時更新することがあります。重要な変更はアプリ内で通知し、変更の発効後も利用を継続した場合は更新後の条項に同意したものとみなします。本規約に関するお問い合わせは、アプリ内のサポート窓口をご利用ください。',
      },
    ],
  },

  ko: {
    title: 'WordNew 이용약관',
    updated: `최종 업데이트: ${UPDATED}`,
    intro:
      'WordNew에 오신 것을 환영합니다. 본 이용약관(이하 "약관")은 WordNew 애플리케이션 및 서비스(이하 "서비스")에 대한 접근과 이용에 적용됩니다. 계정을 생성하거나 서비스를 이용하면 아래 조항에 동의하는 것으로 간주되오니 주의 깊게 읽어 주시기 바랍니다.',
    sections: [
      {
        heading: '1. 약관의 동의',
        body: '서비스에 가입, 접근 또는 이용함으로써 귀하는 본 약관에 구속되는 것에 동의합니다. 동의하지 않는 경우 계정을 생성하거나 서비스를 이용하지 마십시오.',
      },
      {
        heading: '2. 이용 자격 및 계정',
        body: '귀하는 거주 지역에서 유효한 계약을 체결할 수 있는 연령(및 현지에서 요구되는 최소 연령 이상)이어야 하며, 미성년자는 부모 또는 보호자의 동의하에만 서비스를 이용해야 합니다. 귀하는 선택한 인증 정보와 계정에서 발생하는 모든 활동에 대해 책임을 지며, 비밀번호를 안전하게 보관하고 무단 사용을 발견하면 즉시 알려야 합니다.',
      },
      {
        heading: '3. 허용되는 이용',
        body: '불법·침해·악의적이거나 유해한 행위, 악성 코드 업로드, 서비스의 방해·역설계·스크래핑, 또는 서비스나 다른 이용자의 데이터에 대한 무단 접근 시도 등 서비스를 오용하지 않을 것에 동의합니다.',
      },
      {
        heading: '4. 귀하의 콘텐츠 및 라이선스',
        body: '귀하가 생성하거나 제출한 콘텐츠(메모, 단어 목록, 환경설정 등)의 소유권은 귀하에게 있습니다. 귀하는 서비스의 운영·보호·개선을 위해서만 해당 콘텐츠를 저장·처리·표시할 수 있는 제한적이고 비독점적인 라이선스를 당사에 부여합니다.',
      },
      {
        heading: '5. 지식재산권',
        body: '서비스(소프트웨어, 디자인, 상표, 학습 자료 포함)는 지식재산권으로 보호되며 해당 권리자에게 귀속됩니다. 귀하에게는 본인의 학습을 위해 서비스를 이용할 수 있는 개인적이고 양도 불가능하며 철회 가능한 라이선스가 부여됩니다.',
      },
      {
        heading: '6. 개인정보 및 데이터',
        body: '당사는 계정 정보, 학습 진행 상황, 환경설정 등 서비스 제공에 필요한 데이터만 수집·처리합니다. 당사는 귀하의 개인정보를 판매하지 않습니다. 별도의 개인정보 처리방침이 제공되는 경우 이는 본 약관의 일부를 구성합니다.',
      },
      {
        heading: '7. 제3자 서비스',
        body: '서비스는 제3자 기능(소셜 로그인, 미디어, 사전, AI 제공자 등)을 통합할 수 있습니다. 해당 기능의 이용에는 관련 제3자의 약관 및 개인정보 처리 방침도 적용되며, 이에 대해 당사는 책임지지 않습니다.',
      },
      {
        heading: '8. 면책 및 책임의 제한',
        body: '서비스는 어떠한 종류의 보증도 없이 "있는 그대로" 및 "이용 가능한 상태로" 제공되며 학습 결과는 보장되지 않습니다. 법이 허용하는 최대 범위 내에서 당사는 귀하의 서비스 이용으로 인해 발생하는 간접적·부수적·결과적 손해에 대해 책임지지 않습니다.',
      },
      {
        heading: '9. 이용 정지 및 해지',
        body: '귀하는 언제든지 서비스 이용을 중단하고 계정을 삭제할 수 있습니다. 귀하가 본 약관을 위반하거나 서비스와 이용자를 보호하기 위해 당사는 접근을 정지하거나 해지할 수 있습니다.',
      },
      {
        heading: '10. 변경 및 문의',
        body: '당사는 본 약관을 수시로 업데이트할 수 있습니다. 중요한 변경 사항은 앱 내에서 알려드리며, 변경 발효 후에도 이용을 계속하면 업데이트된 약관에 동의한 것으로 간주됩니다. 본 약관에 관한 문의는 앱 내 지원 채널을 이용해 주십시오.',
      },
    ],
  },
};

/** The agreement document for a UI language (falls back to English). */
export function getUserAgreement(lang: string): WfNewAgreementDoc {
  return WFNEW_USER_AGREEMENT[(lang in WFNEW_USER_AGREEMENT ? lang : 'en') as WfNewAgreementLang];
}
