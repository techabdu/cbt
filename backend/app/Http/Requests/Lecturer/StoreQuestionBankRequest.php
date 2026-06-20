<?php

namespace App\Http\Requests\Lecturer;

use App\Enums\Semester;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreQuestionBankRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'title'     => ['nullable', 'string', 'max:255'],
            'session'   => ['required', 'string', 'regex:/^\d{4}\/\d{4}$/'],
            'semester'  => ['required', Rule::enum(Semester::class)],
        ];
    }

    /**
     * Confirm the authenticated lecturer is actually assigned to the chosen course
     * for the given session + semester before they can author questions for it.
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $teaches = $this->user()->lecturerCourses()
                    ->where('course_id', $this->input('course_id'))
                    ->where('session', $this->input('session'))
                    ->where('semester', $this->input('semester'))
                    ->exists();

                if (! $teaches) {
                    $validator->errors()->add('course_id',
                        'You are not assigned to this course for the selected session and semester.');
                }
            },
        ];
    }
}
