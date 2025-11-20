"""
Q&A System for AI Collaboration
Enables AIs to ask and answer questions asynchronously
"""

import time
import uuid
import threading
from typing import Dict, List, Optional
from pathlib import Path

class QASystem:
    """Manages asynchronous Q&A between AI roles"""

    def __init__(self, storage_manager, qa_file: Path):
        self.storage = storage_manager
        self.qa_file = qa_file
        self._lock = threading.Lock()

        self.questions: Dict[str, Dict] = self._load_questions()

    def _load_questions(self) -> Dict[str, Dict]:
        """Load questions from storage"""
        return self.storage.load_json(self.qa_file, {})

    def _save_questions(self) -> bool:
        """Save questions to storage"""
        return self.storage.save_json(self.qa_file, self.questions)

    def ask_question(
        self,
        from_role: str,
        from_session_id: str,
        to_role: str,
        question: str,
        context: Dict = None,
        priority: str = 'normal'
    ) -> Dict:
        """
        Ask a question to another AI role

        Args:
            from_role: Asking role name
            from_session_id: Asking role's session ID
            to_role: Target role name
            question: Question text
            context: Optional context information
            priority: Question priority ('low', 'normal', 'high', 'urgent')

        Returns:
            Question creation result with question_id
        """
        try:
            question_id = str(uuid.uuid4())

            question_data = {
                'question_id': question_id,
                'from_role': from_role,
                'from_session_id': from_session_id,
                'to_role': to_role,
                'question': question,
                'context': context or {},
                'priority': priority,
                'status': 'pending',
                'asked_at': time.time(),
                'answered_at': None,
                'answer': None,
                'answered_by_session_id': None
            }

            with self._lock:
                self.questions[question_id] = question_data

            self._save_questions()

            return {
                'success': True,
                'message': 'Question submitted successfully',
                'question_id': question_id,
                'question': question_data
            }

        except Exception as e:
            import sys
            print(f"Error asking question: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

    def get_pending_questions(
        self,
        role_name: str,
        session_id: str = None,
        priority_filter: List[str] = None,
        limit: int = 50
    ) -> Dict:
        """
        Get pending questions for a specific role

        Args:
            role_name: Role name to get questions for
            session_id: Optional session ID to filter by
            priority_filter: Optional list of priorities to include
            limit: Maximum number of questions to return

        Returns:
            List of pending questions
        """
        try:
            with self._lock:
                pending = []

                for question_id, question_data in self.questions.items():
                    if question_data['to_role'] != role_name:
                        continue

                    if question_data['status'] != 'pending':
                        continue

                    if priority_filter and question_data['priority'] not in priority_filter:
                        continue

                    pending.append(question_data)

                priority_order = {'urgent': 0, 'high': 1, 'normal': 2, 'low': 3}
                pending.sort(key=lambda x: (
                    priority_order.get(x['priority'], 2),
                    x['asked_at']
                ))

                if limit:
                    pending = pending[:limit]

                return {
                    'success': True,
                    'questions': pending,
                    'count': len(pending),
                    'role_name': role_name
                }

        except Exception as e:
            import sys
            print(f"Error getting pending questions: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'questions': []
            }

    def answer_question(
        self,
        question_id: str,
        answer: str,
        answering_session_id: str,
        metadata: Dict = None
    ) -> Dict:
        """
        Answer a pending question

        Args:
            question_id: ID of the question to answer
            answer: Answer text
            answering_session_id: Session ID of the answering AI
            metadata: Optional metadata

        Returns:
            Answer result
        """
        try:
            question_data = None

            with self._lock:
                if question_id not in self.questions:
                    return {
                        'success': False,
                        'error': 'Question not found'
                    }

                question_data = self.questions[question_id]

                if question_data['status'] == 'answered':
                    return {
                        'success': False,
                        'error': 'Question already answered',
                        'existing_answer': question_data['answer']
                    }

                question_data['status'] = 'answered'
                question_data['answer'] = answer
                question_data['answered_at'] = time.time()
                question_data['answered_by_session_id'] = answering_session_id
                question_data['answer_metadata'] = metadata or {}

            self._save_questions()

            return {
                'success': True,
                'message': 'Question answered successfully',
                'question_id': question_id,
                'question': question_data
            }

        except Exception as e:
            import sys
            print(f"Error answering question: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

    def get_question_by_id(self, question_id: str) -> Optional[Dict]:
        """
        Get a specific question by ID

        Args:
            question_id: Question ID

        Returns:
            Question data or None
        """
        with self._lock:
            return self.questions.get(question_id)

    def get_question_history(
        self,
        role_name: str = None,
        session_id: str = None,
        status: str = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict:
        """
        Get question history with optional filters

        Args:
            role_name: Filter by role (either asking or answering)
            session_id: Filter by session ID
            status: Filter by status ('pending' or 'answered')
            limit: Maximum number of questions
            offset: Number of questions to skip

        Returns:
            Question history
        """
        try:
            with self._lock:
                questions = []

                for question_id, question_data in self.questions.items():
                    if role_name:
                        if question_data['from_role'] != role_name and question_data['to_role'] != role_name:
                            continue

                    if session_id:
                        if (question_data['from_session_id'] != session_id and
                            question_data.get('answered_by_session_id') != session_id):
                            continue

                    if status:
                        if question_data['status'] != status:
                            continue

                    questions.append(question_data)

                questions.sort(key=lambda x: x['asked_at'], reverse=True)

                start_index = offset
                end_index = offset + limit
                selected = questions[start_index:end_index]

                return {
                    'success': True,
                    'questions': selected,
                    'total_count': len(questions),
                    'returned_count': len(selected)
                }

        except Exception as e:
            import sys
            print(f"Error getting question history: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'questions': []
            }

    def get_conversations(self, role1: str, role2: str, limit: int = 50) -> Dict:
        """
        Get Q&A conversations between two roles

        Args:
            role1: First role name
            role2: Second role name
            limit: Maximum number of questions

        Returns:
            Conversation history
        """
        try:
            with self._lock:
                conversations = []

                for question_id, question_data in self.questions.items():
                    if ((question_data['from_role'] == role1 and question_data['to_role'] == role2) or
                        (question_data['from_role'] == role2 and question_data['to_role'] == role1)):
                        conversations.append(question_data)

                conversations.sort(key=lambda x: x['asked_at'], reverse=True)

                if limit:
                    conversations = conversations[:limit]

                return {
                    'success': True,
                    'conversations': conversations,
                    'count': len(conversations),
                    'role1': role1,
                    'role2': role2
                }

        except Exception as e:
            import sys
            print(f"Error getting conversations: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'conversations': []
            }

    def get_statistics(self) -> Dict:
        """
        Get Q&A statistics

        Returns:
            Statistics about questions
        """
        try:
            with self._lock:
                stats = {
                    'total_questions': len(self.questions),
                    'pending_questions': 0,
                    'answered_questions': 0,
                    'by_priority': {'low': 0, 'normal': 0, 'high': 0, 'urgent': 0},
                    'by_role': {},
                    'average_response_time': 0
                }

                response_times = []

                for question_data in self.questions.values():
                    if question_data['status'] == 'pending':
                        stats['pending_questions'] += 1
                    elif question_data['status'] == 'answered':
                        stats['answered_questions'] += 1

                        if question_data['answered_at'] and question_data['asked_at']:
                            response_time = question_data['answered_at'] - question_data['asked_at']
                            response_times.append(response_time)

                    priority = question_data.get('priority', 'normal')
                    stats['by_priority'][priority] = stats['by_priority'].get(priority, 0) + 1

                    from_role = question_data['from_role']
                    to_role = question_data['to_role']

                    if from_role not in stats['by_role']:
                        stats['by_role'][from_role] = {'asked': 0, 'answered': 0}
                    stats['by_role'][from_role]['asked'] += 1

                    if to_role not in stats['by_role']:
                        stats['by_role'][to_role] = {'asked': 0, 'answered': 0}
                    if question_data['status'] == 'answered':
                        stats['by_role'][to_role]['answered'] += 1

                if response_times:
                    stats['average_response_time'] = sum(response_times) / len(response_times)

                return {
                    'success': True,
                    'statistics': stats
                }

        except Exception as e:
            import sys
            print(f"Error getting statistics: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

    def cleanup_old_questions(self, max_age_days: int = 30):
        """
        Remove old answered questions

        Args:
            max_age_days: Maximum age in days for answered questions
        """
        try:
            current_time = time.time()
            cutoff_time = current_time - (max_age_days * 24 * 60 * 60)
            old_questions = []

            with self._lock:
                old_questions = [
                    qid for qid, qdata in self.questions.items()
                    if qdata['status'] == 'answered' and qdata.get('answered_at', 0) < cutoff_time
                ]

                for qid in old_questions:
                    del self.questions[qid]
                    import sys
                    print(f"Removed old question: {qid}", file=sys.stderr)

            if old_questions:
                self._save_questions()

        except Exception as e:
            import sys
            print(f"Error cleaning up old questions: {e}", file=sys.stderr)
