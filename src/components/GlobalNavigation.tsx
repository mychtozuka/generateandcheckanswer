import Link from 'next/link';

export default function GlobalNavigation() {
    return (
        <nav className="bg-gray-800 text-white p-4">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex space-x-4">
                    <Link href="/" className="hover:text-gray-300">
                        Generate&CheckAnswer
                    </Link>
                    <Link href="/generate-question" className="hover:text-gray-300">
                        GenerateQuestion
                    </Link>
                    <Link href="/generate-image" className="hover:text-gray-300">
                        問題画像生成(試作中)
                    </Link>

                    <Link href="/generate-graph" className="hover:text-gray-300">
                        グラフ・図形生成
                    </Link>
                </div>
            </div>
        </nav>
    );
}
